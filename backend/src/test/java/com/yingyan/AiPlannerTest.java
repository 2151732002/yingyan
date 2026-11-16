package com.yingyan;

import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

class AiPlannerTest {
    final ObjectMapper json=new ObjectMapper();
    Models.Project project(){return new Models.Project("p1","雨夜咖啡馆","告别","剧情",45,1,false,Models.Document.empty(),null,null);}
    @Test void plainChineseConversationReplyPreservesTheExistingDraft()throws Exception {
        var draft=new Models.Document("已有故事","已有对白",java.util.List.of(),java.util.List.of(),java.util.List.of());
        var reply=chatWithParts(java.util.List.of("可以，我们先讨论人物的动机。你希望他们为什么重逢？"),draft);
        assertThat(reply.reply()).contains("先讨论人物的动机","草稿保持不变");
        assertThat(reply.document()).isEqualTo(draft);
    }
    @Test void splitStructuredTextIsJoinedBeforeParsing()throws Exception {
        var draft=Models.Document.empty();String encoded=json.writeValueAsString(new Models.ChatReply("确认设定",draft));
        var reply=chatWithParts(java.util.List.of(encoded.substring(0,12),encoded.substring(12)),draft);
        assertThat(reply.reply()).isEqualTo("确认设定");assertThat(reply.document()).isEqualTo(draft);
    }
    @Test void leadingBomIsRemovedBeforeDecodingStructuredOutput()throws Exception {
        var draft=Models.Document.empty();String encoded=json.writeValueAsString(new Models.ChatReply("确认",draft));
        var reply=chatWithParts(java.util.List.of("\uFEFF"+encoded),draft);
        assertThat(reply.reply()).isEqualTo("确认");assertThat(reply.document()).isEqualTo(draft);
    }
    @Test void malformedStructuredJsonIsNotSilentlyTurnedIntoDiscussion()throws Exception {
        assertThatThrownBy(()->chatWithParts(java.util.List.of("{\"reply\":\"broken\",\"document\":"),Models.Document.empty()))
            .isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("AI_INVALID_OUTPUT"));
    }
    Models.ChatReply chatWithParts(java.util.List<String> parts,Models.Document draft)throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/responses",exchange->{
            var packet=json.createObjectNode();packet.put("status","completed");var content=packet.putArray("output").addObject().putArray("content");
            for(String part:parts)content.addObject().put("type","output_text").put("text",part);
            byte[] response=json.writeValueAsBytes(packet);exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try{return new AiPlanner(json,"dummy-key","model","http://127.0.0.1:"+server.getAddress().getPort()).converse("讨论人物",project(),draft,java.util.List.of());}
        finally{server.stop(0);}
    }
    @Test @ExtendWith(OutputCaptureExtension.class)
    void invalidGeneratedJsonLogsOnlySafeLocationMetadata(CapturedOutput captured)throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/responses",exchange->{
            String invalid="{\"reply\":\"sensitive-story\",\"document\":{\"script\":\"first\nsecond\"}}";
            byte[] response=("{\"status\":\"completed\",\"output\":[{\"content\":[{\"type\":\"output_text\",\"text\":"+json.writeValueAsString(invalid)+"}]}]}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try{
            var planner=new AiPlanner(json,"private-key","model","http://127.0.0.1:"+server.getAddress().getPort());
            assertThatThrownBy(()->planner.converse("test",project(),Models.Document.empty(),java.util.List.of())).isInstanceOf(ApiException.class);
            assertThat(captured.getAll()).contains("stage=generated","field=script").doesNotContain("sensitive-story","private-key");
        }finally{server.stop(0);}
    }
    @Test void conversationSendsLatestDraftAndHistoryAndParsesReplyEnvelope()throws Exception {
        var received=new AtomicReference<JsonNode>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var draft=new Models.Document("当前已修改的雨夜故事","台词",java.util.List.of(),java.util.List.of(),java.util.List.of());
        server.createContext("/responses",exchange->{
            received.set(json.readTree(exchange.getRequestBody()));
            var envelope=json.writeValueAsString(new Models.ChatReply("保留人物，改成开放结局。",draft));
            byte[] response=("{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\",\"content\":[]},{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":"+json.writeValueAsString(envelope)+"}]}]}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try{
            var planner=new AiPlanner(json,"test-secret","deepseek-flash","http://127.0.0.1:"+server.getAddress().getPort());
            var history=java.util.List.of(new Models.ChatMessage("1","user","人物保持克制",null),new Models.ChatMessage("2","assistant","已保留克制的人设",null));
            var reply=planner.converse("改成开放结局",project(),draft,history);
            assertThat(reply.reply()).contains("开放结局");assertThat(reply.document()).isEqualTo(draft);
            var request=received.get();assertThat(request.path("input").size()).isEqualTo(4);
            assertThat(request.path("input").get(0).path("content").asText()).contains(draft.story(),project().title());
            assertThat(request.path("input").get(1).path("content").asText()).isEqualTo("人物保持克制");
            assertThat(request.path("input").get(3).path("content").asText()).isEqualTo("改成开放结局");
            assertThat(request.path("text").path("format").path("schema").path("properties").has("document")).isTrue();
            assertThat(request.path("instructions").asText()).contains("JSON 输出示例","\"reply\"","\"document\"");
            assertThat(request.toString()).doesNotContain("test-secret");
        }finally{server.stop(0);}
    }
    @Test void connectionTimeoutHasItsOwnSafeActionableError()throws Exception {
        var client=mock(HttpClient.class);
        when(client.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenThrow(new HttpConnectTimeoutException("dummy-key-secret"));
        var planner=new AiPlanner(json,"dummy-key","model","https://api.openai.com/v1",client);
        assertThatThrownBy(()->planner.suggest("test",project())).isInstanceOfSatisfying(ApiException.class,e->{
            assertThat(e.status()).isEqualTo(504);assertThat(e.code()).isEqualTo("AI_CONNECT_TIMEOUT");
            assertThat(e.getMessage()).contains("连接超时").doesNotContain("dummy-key","解析");
        });
    }
    @Test void responseTimeoutIsDifferentFromConnectionTimeout()throws Exception {
        var client=mock(HttpClient.class);
        when(client.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenThrow(new HttpTimeoutException("dummy-key-secret"));
        var planner=new AiPlanner(json,"dummy-key","model","https://api.openai.com/v1",client);
        assertThatThrownBy(()->planner.suggest("test",project())).isInstanceOfSatisfying(ApiException.class,e->{
            assertThat(e.status()).isEqualTo(504);assertThat(e.code()).isEqualTo("AI_RESPONSE_TIMEOUT");
            assertThat(e.getMessage()).doesNotContain("dummy-key");
        });
    }
    @Test void malformedOutputIsNotReportedAsANetworkFailure()throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/responses",exchange->{byte[] b="not-json-secret".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,b.length);exchange.getResponseBody().write(b);exchange.close();});server.start();
        try{
            var planner=new AiPlanner(json,"dummy-key","model","http://127.0.0.1:"+server.getAddress().getPort());
            assertThatThrownBy(()->planner.suggest("test",project())).isInstanceOfSatisfying(ApiException.class,e->{assertThat(e.code()).isEqualTo("AI_INVALID_OUTPUT");assertThat(e.getMessage()).doesNotContain("not-json-secret","dummy-key");});
        }finally{server.stop(0);}
    }
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
