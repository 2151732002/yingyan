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

@SpringBootTest(properties={"spring.datasource.url=${TEST_SPEECH_DB_URL:jdbc:h2:mem:speech;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}","spring.datasource.username=${TEST_DB_USER:sa}","spring.datasource.password=${TEST_DB_PASSWORD:}","spring.datasource.driver-class-name=${TEST_DB_DRIVER:org.h2.Driver}","yingyan.admin-username=director","yingyan.admin-password=test-password-2026","yingyan.storage=target/speech-files","yingyan.speech.worker-enabled=false","yingyan.ai.api-key="})
@AutoConfigureMockMvc
class SpeechTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
    @Autowired SpeechWorker worker;
    @MockitoBean SpeechProvider provider;
    @BeforeEach void setup(){jdbc.update("DELETE FROM story_speech_job");jdbc.update("DELETE FROM story_voice_binding");when(provider.configured()).thenReturn(true);when(provider.synthesize(anyString(),anyString())).thenReturn(new SpeechProvider.Audio(wav(),0.1));}
    static byte[] wav(){var b=java.nio.ByteBuffer.allocate(4844).order(java.nio.ByteOrder.LITTLE_ENDIAN);b.put("RIFF".getBytes()).putInt(4836).put("WAVEfmt ".getBytes()).putInt(16).putShort((short)1).putShort((short)1).putInt(24000).putInt(48000).putShort((short)2).putShort((short)16).put("data".getBytes()).putInt(4800);return b.array();}
    JsonNode body(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
    Cookie login()throws Exception{return mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"username\":\"director\",\"password\":\"test-password-2026\"}")).andExpect(status().isOk()).andReturn().getResponse().getCookie("yingyan_session");}
    String project(Cookie c)throws Exception{
        var p=body(mvc.perform(post("/api/projects").cookie(c).contentType("application/json").content("{\"title\":\"语音验收\",\"logline\":\"\",\"genre\":\"剧情\",\"targetDuration\":30}")).andReturn());String id=p.path("id").asText();
        save(c,id,1,"你好。");return id;
    }
    void save(Cookie c,String id,int revision,String text)throws Exception{
        var ch=new Models.Character("a","小许","","","","温柔声线","");var scene=new Models.Scene("room","室内","","","");
        var line=new Models.Dialogue("line-a","a",text,"克制",1,"ON_SCREEN");
        var shot=new Models.Shot("shot-a","room","对话","DIALOGUE","CLOSEUP","",List.of("a"),5,line);
        var d=new Models.Document("虚构验收","",List.of(ch),List.of(scene),List.of(shot));
        mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(new Models.SaveProject(revision,"语音验收","","剧情",30,d,"测试保存")))).andExpect(status().isOk());
    }
    JsonNode state(Cookie c,String id)throws Exception{return body(mvc.perform(get("/api/projects/"+id+"/speech").cookie(c)).andExpect(status().isOk()).andReturn());}
    JsonNode bind(Cookie c,String id,int version,String voice)throws Exception{return body(mvc.perform(put("/api/projects/"+id+"/speech/voices/a").cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",2,"expectedVersion",version,"voiceId",voice)))).andExpect(status().isOk()).andReturn());}
    JsonNode queue(Cookie c,String id,int revision)throws Exception{return body(mvc.perform(post("/api/projects/"+id+"/speech/jobs").cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",revision,"shotId","shot-a","expectedVoiceVersion",1)))).andExpect(status().isAccepted()).andReturn());}
    @Test void durableJobsKeepVersionsAndDetectChangedText()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"stella");var job=queue(c,id,2);
        assertThat(job.path("status").asText()).isEqualTo("QUEUED");assertThat(state(c,id).path("jobs").size()).isEqualTo(1);
        worker.tick();var done=state(c,id).path("jobs").get(0);assertThat(done.path("status").asText()).isEqualTo("SUCCEEDED");assertThat(done.path("stale").asBoolean()).isFalse();
        mvc.perform(get(done.path("url").asText()).cookie(c)).andExpect(status().isOk()).andExpect(content().contentType("audio/wav"));
        save(c,id,2,"雨停了。");assertThat(state(c,id).path("jobs").get(0).path("stale").asBoolean()).isTrue();
        var next=queue(c,id,3);worker.tick();var all=state(c,id).path("jobs");assertThat(all.size()).isEqualTo(2);assertThat(all.get(0).path("id").asText()).isEqualTo(next.path("id").asText());
        verify(provider).synthesize("你好。","stella");verify(provider).synthesize("雨停了。","stella");
    }
    @Test void rejectsDuplicatesStaleBindingsAndUnconfiguredProvider()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"tide");queue(c,id,2);
        mvc.perform(post("/api/projects/"+id+"/speech/jobs").cookie(c).contentType("application/json").content("{\"expectedRevision\":2,\"shotId\":\"shot-a\",\"expectedVoiceVersion\":1}")).andExpect(status().isConflict());
        mvc.perform(put("/api/projects/"+id+"/speech/voices/a").cookie(c).contentType("application/json").content("{\"expectedRevision\":2,\"expectedVersion\":0,\"voiceId\":\"stella\"}")).andExpect(status().isConflict());
        when(provider.configured()).thenReturn(false);
        mvc.perform(post("/api/projects/"+id+"/speech/previews").cookie(c).contentType("application/json").content("{\"voiceId\":\"stella\",\"expectedRevision\":2}")).andExpect(status().isServiceUnavailable());
    }
    @Test void failureIsPersistedWithoutRetryAndPrivateFilesCannotBeReadByOthers()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"stella");var job=queue(c,id,2);
        when(provider.synthesize(anyString(),anyString())).thenThrow(new ApiException(502,"SPEECH_PROVIDER_ERROR","语音服务暂时不可用"));worker.tick();worker.tick();
        assertThat(state(c,id).path("jobs").get(0).path("status").asText()).isEqualTo("FAILED");verify(provider,times(1)).synthesize(anyString(),anyString());
        mvc.perform(get("/api/projects/"+id+"/speech")).andExpect(status().isUnauthorized());
        var other=UUID.randomUUID().toString();
        mvc.perform(get("/api/speech/jobs/"+job.path("id").asText()+"/file").cookie(c)).andExpect(status().isConflict());
        jdbc.update("INSERT INTO app_user(id,username,password_hash) VALUES(?,?,?)",other,"speech-"+other,"unused");
        jdbc.update("UPDATE story_speech_job SET owner_id=? WHERE id=?",other,job.path("id").asText());
        mvc.perform(get("/api/speech/jobs/"+job.path("id").asText()+"/file").cookie(c)).andExpect(status().isNotFound());
    }
    @Test void interruptedRunningTaskFailsButQueuedTaskIsRecovered()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"stella");var job=queue(c,id,2);
        jdbc.update("UPDATE story_speech_job SET status='RUNNING', lease_until=? WHERE id=?",java.time.LocalDateTime.now().minusMinutes(1),job.path("id").asText());worker.tick();
        assertThat(state(c,id).path("jobs").get(0).path("status").asText()).isEqualTo("FAILED");verify(provider,never()).synthesize(anyString(),anyString());
        queue(c,id,2);worker.tick();assertThat(state(c,id).path("jobs").get(0).path("status").asText()).isEqualTo("SUCCEEDED");
    }
    @Test void voiceChangeExpiresAudioWithoutChangingTheScriptRevision()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"stella");queue(c,id,2);worker.tick();bind(c,id,1,"tide");
        assertThat(state(c,id).path("jobs").get(0).path("stale").asBoolean()).isTrue();
        assertThat(body(mvc.perform(get("/api/projects/"+id).cookie(c)).andReturn()).path("revision").asInt()).isEqualTo(2);
        mvc.perform(post("/api/projects/"+id+"/speech/jobs").cookie(c).contentType("application/json").content("{\"expectedRevision\":2,\"shotId\":\"shot-a\",\"expectedVoiceVersion\":1}")).andExpect(status().isConflict());
    }
    @Test void twoCharactersUseTheirOwnVoicesAndOnlyChangedLineExpires()throws Exception{
        var c=login();var id=project(c);
        var p=body(mvc.perform(get("/api/projects/"+id).cookie(c)).andReturn());var d=(com.fasterxml.jackson.databind.node.ObjectNode)p.path("document");
        var chars=(com.fasterxml.jackson.databind.node.ArrayNode)d.path("characters");var second=chars.get(0).deepCopy();((com.fasterxml.jackson.databind.node.ObjectNode)second).put("id","b").put("name","小周");chars.add(second);
        var shots=(com.fasterxml.jackson.databind.node.ArrayNode)d.path("shots");var s=shots.get(0).deepCopy();((com.fasterxml.jackson.databind.node.ObjectNode)s).put("id","shot-b");((com.fasterxml.jackson.databind.node.ArrayNode)s.path("visibleCharacterIds")).removeAll().add("b");((com.fasterxml.jackson.databind.node.ObjectNode)s.path("dialogue")).put("id","line-b").put("speakerId","b").put("text","是的，雨停了。");shots.add(s);
        mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",2,"title","双人对白","logline","","genre","剧情","targetDuration",30,"document",d,"summary","测试")))).andExpect(status().isOk());
        for(var entry:Map.of("a","stella","b","tide").entrySet())mvc.perform(put("/api/projects/"+id+"/speech/voices/"+entry.getKey()).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",3,"expectedVersion",0,"voiceId",entry.getValue())))).andExpect(status().isOk());
        queue(c,id,3);mvc.perform(post("/api/projects/"+id+"/speech/jobs").cookie(c).contentType("application/json").content("{\"expectedRevision\":3,\"shotId\":\"shot-b\",\"expectedVoiceVersion\":1}")).andExpect(status().isAccepted());worker.tick();worker.tick();
        verify(provider).synthesize("你好。","stella");verify(provider).synthesize("是的，雨停了。","tide");
        ((com.fasterxml.jackson.databind.node.ObjectNode)shots.get(0).path("dialogue")).put("text","再见。");
        mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",3,"title","双人对白","logline","","genre","剧情","targetDuration",30,"document",d,"summary","测试修改一句")))).andExpect(status().isOk());
        for(var j:state(c,id).path("jobs"))assertThat(j.path("stale").asBoolean()).isEqualTo(j.path("characterId").asText().equals("a"));
    }
    @Test void concurrentWorkersCannotSynthesizeTheSameTaskTwice()throws Exception{
        var c=login();var id=project(c);bind(c,id,0,"stella");queue(c,id,2);
        when(provider.synthesize(anyString(),anyString())).thenAnswer(inv->{Thread.sleep(150);return new SpeechProvider.Audio(wav(),0.1);});
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){var a=pool.submit(()->worker.tick());var b=pool.submit(()->worker.tick());a.get();b.get();}
        verify(provider,times(1)).synthesize(anyString(),anyString());assertThat(state(c,id).path("jobs").get(0).path("status").asText()).isEqualTo("SUCCEEDED");
    }
    @Test void archivedProjectsCannotStartSpeechAndOwnersCannotInspectOthersProjects()throws Exception{
        var c=login();var id=project(c);mvc.perform(post("/api/projects/"+id+"/archive").cookie(c).contentType("application/json").content("{\"expectedRevision\":2}")).andExpect(status().isOk());
        mvc.perform(post("/api/projects/"+id+"/speech/previews").cookie(c).contentType("application/json").content("{\"expectedRevision\":3,\"voiceId\":\"stella\"}")).andExpect(status().isBadRequest());
        var other=UUID.randomUUID().toString();jdbc.update("INSERT INTO app_user(id,username,password_hash) VALUES(?,?,?)",other,"other-"+other,"unused");jdbc.update("UPDATE story_project SET owner_id=? WHERE id=?",other,id);
        mvc.perform(get("/api/projects/"+id+"/speech").cookie(c)).andExpect(status().isNotFound());
    }
}
