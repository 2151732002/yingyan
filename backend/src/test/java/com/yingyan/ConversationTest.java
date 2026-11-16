package com.yingyan;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=${TEST_CHAT_DB_URL:jdbc:h2:mem:conversation;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}","spring.datasource.username=${TEST_DB_USER:sa}","spring.datasource.password=${TEST_DB_PASSWORD:}","spring.datasource.driver-class-name=${TEST_DB_DRIVER:org.h2.Driver}","yingyan.admin-username=director","yingyan.admin-password=test-password-2026","yingyan.storage=target/test-files","yingyan.ai.api-key="})
@AutoConfigureMockMvc
class ConversationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired ProjectService projects;
    @MockitoBean AiPlanner ai;
    @BeforeEach void configured(){when(ai.configured()).thenReturn(true);when(ai.model()).thenReturn("test-model");}
    JsonNode body(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
    Cookie login()throws Exception{return mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"username\":\"director\",\"password\":\"test-password-2026\"}")).andExpect(status().isOk()).andReturn().getResponse().getCookie("yingyan_session");}
    String create(Cookie c)throws Exception{return body(mvc.perform(post("/api/projects").cookie(c).contentType("application/json").content("{\"title\":\"雨夜拿铁\",\"logline\":\"\",\"genre\":\"剧情\",\"targetDuration\":45}")).andExpect(status().isCreated()).andReturn()).path("id").asText();}
    JsonNode state(Cookie c,String id)throws Exception{return body(mvc.perform(get("/api/projects/"+id+"/conversation").cookie(c)).andExpect(status().isOk()).andReturn());}
    JsonNode turn(Cookie c,String id,int version,String message)throws Exception{return body(mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedVersion",version,"expectedRevision",1,"message",message)))).andExpect(status().isOk()).andReturn());}
    Models.Document doc(String text){return new Models.Document(text,"对白："+text,List.of(),List.of(),List.of());}
    void answer(String story){doReturn(new Models.ChatReply("已按你的要求修改。",doc(story))).when(ai).converse(anyString(),any(),any(),anyList());}
    @Test void iterativeDraftPersistsAndOnlyExplicitSaveCreatesARevision()throws Exception{
        var c=login();String id=create(c);assertThat(state(c,id).path("version").asInt()).isEqualTo(1);
        when(ai.converse(anyString(),any(),any(),anyList())).thenReturn(new Models.ChatReply("先写初稿。",doc("初次重逢")),new Models.ChatReply("改为开放结局。",doc("初次重逢，开放结局")));
        var first=turn(c,id,1,"写重逢");assertThat(first.path("document").path("story").asText()).isEqualTo("初次重逢");
        var second=turn(c,id,2,"改成开放结局");assertThat(second.path("messages").size()).isEqualTo(4);
        verify(ai).converse(eq("改成开放结局"),any(),eq(doc("初次重逢")),argThat(h->h.size()==2&&h.get(0).content().equals("写重逢")));
        assertThat(state(c,id).path("document").path("story").asText()).contains("开放结局");
        assertThat(body(mvc.perform(get("/api/projects/"+id).cookie(c)).andReturn()).path("revision").asInt()).isEqualTo(1);
        var saved=body(mvc.perform(post("/api/projects/"+id+"/conversation/save").cookie(c).contentType("application/json").content("{\"expectedVersion\":3,\"expectedRevision\":1}")).andExpect(status().isOk()).andReturn());
        assertThat(saved.path("project").path("revision").asInt()).isEqualTo(2);
        assertThat(saved.path("conversation").path("hasChanges").asBoolean()).isFalse();
        assertThat(saved.path("conversation").path("messages").size()).isEqualTo(4);
        assertThat(body(mvc.perform(get("/api/projects/"+id+"/revisions/1").cookie(c)).andReturn()).path("document").path("story").asText()).isEmpty();
    }
    @Test void upstreamFailureKeepsDraftAndAllowsRetryWithoutDuplicateMessages()throws Exception{
        var c=login();String id=create(c);state(c,id);
        when(ai.converse(anyString(),any(),any(),anyList())).thenThrow(new ApiException(504,"AI_CONNECT_TIMEOUT","连接超时"));
        mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content("{\"expectedVersion\":1,\"expectedRevision\":1,\"message\":\"重逢\"}")).andExpect(status().isGatewayTimeout());
        var failed=state(c,id);assertThat(failed.path("processing").asBoolean()).isFalse();assertThat(failed.path("messages").size()).isZero();assertThat(failed.path("pendingPrompt").asText()).isEqualTo("重逢");
        answer("重逢");assertThat(turn(c,id,1,"重逢").path("messages").size()).isEqualTo(2);
    }
    @Test void staleAndBusyConversationCannotTriggerAnotherModelCall()throws Exception{
        var c=login();String id=create(c);state(c,id);answer("初稿");turn(c,id,1,"初稿");
        mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content("{\"expectedVersion\":1,\"expectedRevision\":1,\"message\":\"旧窗口\"}")).andExpect(status().isConflict());
        jdbc.update("UPDATE story_conversation SET processing_until=?, request_id='busy' WHERE project_id=?",java.time.LocalDateTime.now().plusSeconds(60),id);
        mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content("{\"expectedVersion\":2,\"expectedRevision\":1,\"message\":\"重复发送\"}")).andExpect(status().isConflict());
        verify(ai,times(1)).converse(anyString(),any(),any(),anyList());
    }
    @Test void projectChangedDuringGenerationIsNotOverwrittenAndCanBeRebased()throws Exception{
        var c=login();String id=create(c);state(c,id);
        when(ai.converse(anyString(),any(),any(),anyList())).thenAnswer(invocation->{
            var p=(Models.Project)invocation.getArgument(1);projects.save(""+jdbc.queryForObject("SELECT owner_id FROM story_project WHERE id=?",String.class,id),id,new Models.SaveProject(1,p.title(),p.logline(),p.genre(),p.targetDuration(),doc("其他窗口的剧本"),"另一窗口"));
            return new Models.ChatReply("AI 修改",doc("过期生成"));
        });
        mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content("{\"expectedVersion\":1,\"expectedRevision\":1,\"message\":\"修改\"}")).andExpect(status().isConflict());
        assertThat(state(c,id).path("stale").asBoolean()).isTrue();
        var rebased=body(mvc.perform(post("/api/projects/"+id+"/conversation/rebase").cookie(c).contentType("application/json").content("{\"expectedVersion\":1,\"expectedRevision\":2}")).andExpect(status().isOk()).andReturn());
        assertThat(rebased.path("conversation").path("document").path("story").asText()).isEqualTo("其他窗口的剧本");
        assertThat(rebased.path("project").path("revision").asInt()).isEqualTo(2);
    }
    @Test void conversationsArePrivateAndArchivedProjectsCannotGenerate()throws Exception{
        var c=login();String id=create(c);state(c,id);
        mvc.perform(get("/api/projects/"+id+"/conversation")).andExpect(status().isUnauthorized());
        String other=UUID.randomUUID().toString();jdbc.update("INSERT INTO app_user(id,username,password_hash) SELECT ?,?,password_hash FROM app_user WHERE username='director'",other,other);
        var stranger=mvc.perform(post("/api/auth/login").contentType("application/json").content(json.writeValueAsBytes(Map.of("username",other,"password","test-password-2026")))).andReturn().getResponse().getCookie("yingyan_session");
        mvc.perform(get("/api/projects/"+id+"/conversation").cookie(stranger)).andExpect(status().isNotFound());
        mvc.perform(post("/api/projects/"+id+"/archive").cookie(c).contentType("application/json").content("{\"expectedRevision\":1}")).andExpect(status().isOk());
        mvc.perform(post("/api/projects/"+id+"/conversation/turns").cookie(c).contentType("application/json").content("{\"expectedVersion\":1,\"expectedRevision\":2,\"message\":\"修改\"}")).andExpect(status().isConflict());
        verify(ai,never()).converse(anyString(),any(),any(),anyList());
    }
}
