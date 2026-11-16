package com.yingyan;

import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class AiPlannerTest {
    final ObjectMapper json=new ObjectMapper();
    Models.Project project(){return new Models.Project("p1","雨夜咖啡馆","告别","剧情",45,1,false,Models.Document.empty(),null,null);}
    @Test void sendsResponsesSchemaAndReturnsDraftWithoutChangingProject()throws Exception {
        var received=new AtomicReference<JsonNode>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/responses",exchange->{
            received.set(json.readTree(exchange.getRequestBody()));
            byte[] response=("{\"status\":\"completed\",\"output\":[{\"content\":[{\"type\":\"output_text\",\"text\":"+json.writeValueAsString("{\"story\":\"一场雨夜的告别\",\"script\":\"你好。\",\"characters\":[],\"scenes\":[],\"shots\":[]}")+"}]}]}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try{
            var planner=new AiPlanner(json,"test-key-only","test-model","http://127.0.0.1:"+server.getAddress().getPort()+"/v1");
            var draft=planner.suggest("写一场告别",project());
            assertThat(draft.story()).isEqualTo("一场雨夜的告别");
            assertThat(received.get().path("text").path("format").path("type").asText()).isEqualTo("json_schema");
            assertThat(received.get().path("text").path("format").path("schema").path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(received.get().toString()).doesNotContain("test-key-only");
            assertThat(project().revision()).isEqualTo(1);
        }finally{server.stop(0);}
    }
    @Test void upstreamErrorsAreSanitized()throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/responses",exchange->{byte[] b="secret-in-upstream-error".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(401,b.length);exchange.getResponseBody().write(b);exchange.close();});server.start();
        try{
            var planner=new AiPlanner(json,"dummy-key","model","http://127.0.0.1:"+server.getAddress().getPort());
            assertThatThrownBy(()->planner.suggest("test",project())).isInstanceOfSatisfying(ApiException.class,e->{assertThat(e.code()).isEqualTo("AI_UPSTREAM_ERROR");assertThat(e.getMessage()).doesNotContain("secret");});
        }finally{server.stop(0);}
    }
}
