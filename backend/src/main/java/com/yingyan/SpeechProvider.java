package com.yingyan;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

@Component
public class SpeechProvider {
    public record Audio(byte[] bytes,double durationSeconds){}
    private final String key,base;private final ObjectMapper json;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    public SpeechProvider(@Value("${yingyan.speech.api-key:}")String speechKey,@Value("${yingyan.speech.base-url:https://api.deepseek.com}")String speechBase,
        @Value("${yingyan.ai.api-key:}")String textKey,@Value("${yingyan.ai.base-url:}")String textBase,ObjectMapper json){
        this.json=json;boolean deepseek=false;try{var uri=URI.create(textBase);deepseek="https".equals(uri.getScheme())&&"api.deepseek.com".equals(uri.getHost());}catch(Exception ignored){}
        key=!speechKey.isBlank()?speechKey:(deepseek?textKey:"");base=speechBase.replaceAll("/+$","").replaceAll("/v1$","");
    }
    public boolean configured(){return !key.isBlank();}
    public Audio synthesize(String text,String voice){
        if(!configured())throw new ApiException(503,"SPEECH_NOT_CONFIGURED","语音服务尚未配置");
        if(!Set.of("stella","tide").contains(voice)||text.isBlank()||text.length()>1000)throw ApiException.bad("台词或音色不合法");
        WebSocket socket=null;CompletableFuture<WebSocket> handshake=null;
        try{
            // HTTP WAV uses unknown-length RIFF headers. WebSocket gives an explicit completion event,
            // so a graceful early stream close cannot accidentally publish incomplete speech.
            String ws=base.replaceFirst("^https:","wss:").replaceFirst("^http:","ws:");
            var listener=new SpeechListener(json,text);
            handshake=client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(15)).header("Authorization","Bearer "+key)
                .buildAsync(URI.create(ws+"/v1/tools/tts?voice_id="+voice+"&format=pcm&filter_markdown=false"),listener);
            socket=handshake.get(16,TimeUnit.SECONDS);return listener.result.get(95,TimeUnit.SECONDS);
        }catch(TimeoutException e){throw new ApiException(504,"SPEECH_TIMEOUT","语音生成超时，请稍后手动重试");}
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiException(503,"SPEECH_INTERRUPTED","语音生成中断，请稍后手动重试");}
        catch(Exception e){
            Throwable cause=e;while(cause instanceof ExecutionException||cause instanceof CompletionException)cause=cause.getCause();
            if(cause instanceof ApiException a)throw a;
            if(cause instanceof WebSocketHandshakeException h)throw providerError(h.getResponse().statusCode());
            throw new ApiException(502,"SPEECH_CONNECTION_ERROR","语音连接失败或音频不完整，请稍后手动重试");
        }finally{if(socket!=null)socket.abort();if(handshake!=null&&!handshake.isDone())handshake.cancel(true);}
    }
    private static ApiException providerError(int status){return new ApiException(502,"SPEECH_PROVIDER_ERROR",switch(status){
        case 401,403 -> "语音服务认证失败，请检查后端 Key 与权限";case 429,503 -> "语音服务繁忙，请稍后手动重试";default -> "语音服务调用失败，请稍后手动重试";});}
    private static final class SpeechListener implements WebSocket.Listener {
        final CompletableFuture<Audio> result=new CompletableFuture<>();private final ByteArrayOutputStream pcm=new ByteArrayOutputStream();private final StringBuilder message=new StringBuilder();private final ObjectMapper json;private final String text;
        SpeechListener(ObjectMapper json,String text){this.json=json;this.text=text;}
        @Override public void onOpen(WebSocket ws){
            ws.request(1);
            try{ws.sendText(json.writeValueAsString(Map.of("event","text","text",text)),true).thenCompose(v->ws.sendText("{\"event\":\"finish_text\"}",true)).whenComplete((v,e)->{if(e!=null)result.completeExceptionally(invalid());});}
            catch(Exception e){result.completeExceptionally(invalid());}
        }
        @Override public CompletionStage<?> onBinary(WebSocket ws,ByteBuffer data,boolean last){
            if(!result.isDone()){
                if((long)pcm.size()+data.remaining()>8_640_000){result.completeExceptionally(invalid());ws.abort();}
                else{byte[] bytes=new byte[data.remaining()];data.get(bytes);pcm.writeBytes(bytes);}
            }
            ws.request(1);return null;
        }
        @Override public CompletionStage<?> onText(WebSocket ws,CharSequence data,boolean last){
            if(message.length()+data.length()>4096){result.completeExceptionally(invalid());ws.abort();return null;}
            message.append(data);
            if(last){try{var event=json.readTree(message.toString());if(event.path("event").asText().equals("finish")){
                if(event.path("code").asText().equals("success"))result.complete(wav(pcm.toByteArray()));
                else result.completeExceptionally(new ApiException(502,"SPEECH_PROVIDER_ERROR",switch(event.path("code").asText()){
                    case "content_filter","invalid_input" -> "语音服务未接受这句台词，请检查内容";
                    default -> "语音生成失败，请稍后手动重试";}));
            }}catch(Exception e){result.completeExceptionally(invalid());}finally{message.setLength(0);}}
            ws.request(1);return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket ws,int status,String reason){if(!result.isDone())result.completeExceptionally(invalid());return null;}
        @Override public void onError(WebSocket ws,Throwable error){result.completeExceptionally(invalid());}
    }
    private static Audio wav(byte[] pcm){
        if(pcm.length==0||pcm.length%2!=0)throw invalid();var b=ByteBuffer.allocate(44+pcm.length).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(pcm.length+36).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1).putInt(24000).putInt(48000).putShort((short)2).putShort((short)16).put("data".getBytes(StandardCharsets.US_ASCII)).putInt(pcm.length).put(pcm);return decode(b.array());
    }
    static Audio decode(byte[] bytes){
        if(bytes.length<44||!tag(bytes,0).equals("RIFF")||!tag(bytes,8).equals("WAVE"))throw invalid();
        var b=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);if(Integer.toUnsignedLong(b.getInt(4))+8!=bytes.length)throw invalid();
        int rate=0,align=0;long data=0;boolean format=false,foundData=false;
        for(int at=12;at+8<=bytes.length;){String tag=tag(bytes,at);long length=Integer.toUnsignedLong(b.getInt(at+4));long end=(long)at+8+length;if(end>bytes.length)throw invalid();
            if(tag.equals("fmt ")){if(length<16||b.getShort(at+8)!=1||b.getShort(at+22)!=16)throw invalid();int channels=b.getShort(at+10);rate=b.getInt(at+12);align=b.getShort(at+20);if(channels<1||channels>2||rate<8000||rate>48000||align!=channels*2||b.getInt(at+16)!=rate*align)throw invalid();format=true;}
            if(tag.equals("data")){data+=length;foundData=true;}
            long next=end+(length%2);if(next>bytes.length)throw invalid();at=(int)next;if(at==bytes.length)break;if(at+8>bytes.length)throw invalid();
        }
        if(!format||!foundData||data<=0||data%align!=0)throw invalid();double duration=(double)data/(rate*align);if(duration>180)throw invalid();return new Audio(bytes,duration);
    }
    private static String tag(byte[] b,int at){return new String(b,at,4,StandardCharsets.US_ASCII);}
    private static ApiException invalid(){return new ApiException(502,"SPEECH_INVALID_AUDIO","语音服务返回的音频不完整或格式不支持，请手动重试");}
}
