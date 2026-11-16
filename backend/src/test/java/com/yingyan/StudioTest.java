package com.yingyan;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=${TEST_DB_URL:jdbc:h2:mem:yingyan;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}",
    "spring.datasource.username=${TEST_DB_USER:sa}","spring.datasource.password=${TEST_DB_PASSWORD:}","spring.datasource.driver-class-name=${TEST_DB_DRIVER:org.h2.Driver}",
    "yingyan.admin-username=director","yingyan.admin-password=test-password-2026","yingyan.storage=target/test-files","yingyan.ai.api-key="})
@AutoConfigureMockMvc
class StudioTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    JsonNode body(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
    Cookie login()throws Exception{return login("director","test-password-2026");}
    Cookie login(String name,String password)throws Exception {
        var response=mvc.perform(post("/api/auth/login").contentType("application/json").content(json.writeValueAsBytes(Map.of("username",name,"password",password))))
            .andExpect(status().isOk()).andReturn().getResponse();
        var c=response.getCookie("yingyan_session");assertThat(c).isNotNull();return c;
    }
    JsonNode create(Cookie c)throws Exception{return body(mvc.perform(post("/api/projects").cookie(c).contentType("application/json").content("{\"title\":\"咖啡馆的最后一句\",\"logline\":\"一场迟到的告别\",\"genre\":\"都市剧情\",\"targetDuration\":45}"))
        .andExpect(status().isCreated()).andReturn());}
    Map<String,Object> document() {
        return Map.of("story","雨夜，林夏在咖啡馆等待陈默。","script","林夏：你真的要走？\n陈默：我会回来。",
          "characters",List.of(Map.of("id","c1","name","林夏","description","咖啡馆店主","appearance","黑色长发","costume","米色风衣","voiceId","voice-a","referenceAssetId",""),
                               Map.of("id","c2","name","陈默","description","摄影师","appearance","短发","costume","黑色外套","voiceId","voice-b","referenceAssetId","")),
          "scenes",List.of(Map.of("id","scene1","name","雨夜咖啡馆","description","窗边双人座","lighting","暖光","blocking","林夏在左，陈默在右")),
          "shots",List.of(Map.of("id","shot1","sceneId","scene1","title","最后的问题","kind","DIALOGUE","framing","CLOSEUP","description","林夏望向画面右侧","visibleCharacterIds",List.of("c1"),"durationSeconds",5,
            "dialogue",Map.of("id","line1","speakerId","c1","text","你真的要走？","emotion","克制","speed",1.0,"delivery","ON_SCREEN"))));
    }
    JsonNode save(Cookie c,String id,int revision,Map<String,Object> doc)throws Exception {
        return body(mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",revision,"title","咖啡馆的最后一句","logline","一场迟到的告别","genre","都市剧情","targetDuration",45,"document",doc,"summary","完善分镜"))))
            .andExpect(status().isOk()).andReturn());
    }
    @Test void requiresLoginAndRejectsWrongPassword()throws Exception {
        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"username\":\"director\",\"password\":\"wrong-password\"}")).andExpect(status().isUnauthorized());
    }
    @Test void loginCreatesPrivateSessionAndLogoutRevokesIt()throws Exception {
        var c=login();mvc.perform(get("/api/auth/session").cookie(c)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").cookie(c)).andExpect(status().isNoContent());
        mvc.perform(get("/api/projects").cookie(c)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForList("SELECT token_hash FROM user_session").toString()).doesNotContain(c.getValue());
    }
    @Test void savesStructuredStoryAndKeepsImmutableRevisions()throws Exception {
        var c=login();var p=create(c);String id=p.get("id").asText();
        assertThat(p.get("revision").asInt()).isEqualTo(1);
        var edited=save(c,id,1,document());assertThat(edited.get("revision").asInt()).isEqualTo(2);
        var reloaded=body(mvc.perform(get("/api/projects/"+id).cookie(c)).andReturn());
        assertThat(reloaded.get("document").get("shots").get(0).get("dialogue").get("speakerId").asText()).isEqualTo("c1");
        var old=body(mvc.perform(get("/api/projects/"+id+"/revisions/1").cookie(c)).andReturn());
        assertThat(old.get("document").get("shots").size()).isZero();
        var history=body(mvc.perform(get("/api/projects/"+id+"/revisions").cookie(c)).andReturn());assertThat(history.size()).isEqualTo(2);
    }
    @Test void staleSaveIsRejectedAndRestoreCreatesNewRevision()throws Exception {
        var c=login();String id=create(c).get("id").asText();save(c,id,1,document());
        mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",1,"title","旧标签页","logline","","genre","剧情","targetDuration",45,"document",document(),"summary","旧保存"))))
            .andExpect(status().isConflict());
        var restored=body(mvc.perform(post("/api/projects/"+id+"/restore").cookie(c).contentType("application/json").content("{\"expectedRevision\":2,\"sourceRevision\":1}"))
            .andExpect(status().isOk()).andReturn());
        assertThat(restored.get("revision").asInt()).isEqualTo(3);assertThat(restored.get("document").get("shots").size()).isZero();
        var old=body(mvc.perform(get("/api/projects/"+id+"/revisions/2").cookie(c)).andReturn());assertThat(old.get("document").get("shots").size()).isEqualTo(1);
    }
    @Test void invalidSpeakerAndDanglingSceneAreRejected()throws Exception {
        var c=login();String id=create(c).get("id").asText();
        var node=json.valueToTree(document());((com.fasterxml.jackson.databind.node.ObjectNode)node.get("shots").get(0).get("dialogue")).put("speakerId","missing");
        mvc.perform(put("/api/projects/"+id).cookie(c).contentType("application/json").content(json.writeValueAsBytes(Map.of("expectedRevision",1,"title","test","logline","","genre","剧情","targetDuration",45,"document",node,"summary","invalid"))))
            .andExpect(status().isBadRequest());
    }
    @Test void uploadIsValidatedAndProtectedFromOtherUsers()throws Exception {
        var c=login();String id=create(c).get("id").asText();var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(80,100,BufferedImage.TYPE_INT_RGB),"png",out);
        var a=body(mvc.perform(multipart("/api/projects/"+id+"/assets").file(new MockMultipartFile("file","reference.png","image/png",out.toByteArray())).cookie(c)).andExpect(status().isCreated()).andReturn());
        mvc.perform(get(a.get("url").asText()).cookie(c)).andExpect(status().isOk());
        mvc.perform(multipart("/api/projects/"+id+"/assets").file(new MockMultipartFile("file","bad.png","image/png",new byte[]{1,2,3})).cookie(c)).andExpect(status().isBadRequest());
        String user=UUID.randomUUID().toString(),name="other"+user.substring(0,8);
        jdbc.update("INSERT INTO app_user(id,username,password_hash) VALUES(?,?,?)",user,name,new BCryptPasswordEncoder().encode("other-password"));
        var stranger=login(name,"other-password");
        mvc.perform(get("/api/projects/"+id).cookie(stranger)).andExpect(status().isNotFound());
        mvc.perform(get(a.get("url").asText()).cookie(stranger)).andExpect(status().isNotFound());
    }
    @Test void archiveRemovesProjectFromActiveListWithoutDeletingHistory()throws Exception {
        var c=login();String id=create(c).get("id").asText();
        mvc.perform(post("/api/projects/"+id+"/archive").cookie(c).contentType("application/json").content("{\"expectedRevision\":1}"))
            .andExpect(status().isOk());
        var all=body(mvc.perform(get("/api/projects").cookie(c)).andReturn());assertThat(all.toString()).doesNotContain(id);
        mvc.perform(get("/api/projects/"+id+"/revisions/1").cookie(c)).andExpect(status().isOk());
    }
    @Test void missingAiConfigurationIsExplicitAndDoesNotModifyProject()throws Exception {
        var c=login();String id=create(c).get("id").asText();
        mvc.perform(post("/api/projects/"+id+"/draft-suggestions").cookie(c).contentType("application/json").content("{\"prompt\":\"写一个双人故事\",\"expectedRevision\":1}"))
            .andExpect(status().isServiceUnavailable());
        assertThat(body(mvc.perform(get("/api/projects/"+id).cookie(c)).andReturn()).get("revision").asInt()).isEqualTo(1);
    }
    @Test void crossSiteMutationsAreRejected()throws Exception {
        mvc.perform(post("/api/auth/login").header("Sec-Fetch-Site","cross-site").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
}
