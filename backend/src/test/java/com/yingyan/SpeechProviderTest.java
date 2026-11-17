package com.yingyan;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

class SpeechProviderTest {
    ServerSocket server;ExecutorService executor;Future<?> handled;
    @AfterEach void stop()throws Exception{if(server!=null)server.close();if(executor!=null)executor.close();}
    SpeechProvider provider(String finish,boolean closeEarly)throws Exception{
        server=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"));executor=Executors.newSingleThreadExecutor();
        handled=executor.submit(()->{try(var socket=server.accept()){
            socket.setSoTimeout(5000);var in=new DataInputStream(socket.getInputStream());var out=new DataOutputStream(socket.getOutputStream());var header=new ByteArrayOutputStream();int c;
            while((c=in.read())!=-1){header.write(c);if(header.toString(StandardCharsets.US_ASCII).endsWith("\r\n\r\n"))break;}
            String request=header.toString(StandardCharsets.US_ASCII);assertThat(request).contains("voice_id=tide","format=pcm","Authorization: Bearer fictional-key");
            String key=Arrays.stream(request.split("\r\n")).filter(l->l.toLowerCase(Locale.ROOT).startsWith("sec-websocket-key:")).findFirst().orElseThrow().split(":",2)[1].trim();
            String accept=Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest((key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.US_ASCII)));
            out.writeBytes("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+accept+"\r\n\r\n");out.flush();
            var json=new ObjectMapper();assertThat(json.readTree(readFrame(in)).path("text").asText()).isEqualTo("你好。");assertThat(json.readTree(readFrame(in)).path("event").asText()).isEqualTo("finish_text");
            frame(out,2,new byte[4800]);if(!closeEarly)frame(out,1,("{\"event\":\"finish\",\"code\":\""+finish+"\"}").getBytes(StandardCharsets.UTF_8));
        }catch(Exception e){throw new RuntimeException(e);}});
        return new SpeechProvider("fictional-key","http://127.0.0.1:"+server.getLocalPort(),"","",new ObjectMapper());
    }
    static byte[] readFrame(DataInputStream in)throws Exception{in.readUnsignedByte();int flags=in.readUnsignedByte();long size=flags&127;if(size==126)size=in.readUnsignedShort();else if(size==127)size=in.readLong();byte[] mask=(flags&128)!=0?in.readNBytes(4):null;byte[] data=in.readNBytes((int)size);if(mask!=null)for(int i=0;i<data.length;i++)data[i]^=mask[i%4];return data;}
    static void frame(DataOutputStream out,int opcode,byte[] data)throws Exception{out.writeByte(128|opcode);if(data.length<126)out.writeByte(data.length);else{out.writeByte(126);out.writeShort(data.length);}out.write(data);out.flush();}
    @Test void requiresExplicitCompletionAndWrapsPcmAsWav()throws Exception{var a=provider("success",false).synthesize("你好。","tide");handled.get();assertThat(a.durationSeconds()).isEqualTo(0.1);assertThat(a.bytes()).hasSize(4844);assertThat(new String(a.bytes(),0,4,StandardCharsets.US_ASCII)).isEqualTo("RIFF");}
    @Test void rejectsEarlyCloseEvenWhenSomeAudioArrived()throws Exception{assertThatThrownBy(()->provider("success",true).synthesize("你好。","tide")).isInstanceOf(ApiException.class).hasMessageContaining("不完整");handled.get();}
    @Test void failedCompletionDoesNotPublishPartialAudio()throws Exception{assertThatThrownBy(()->provider("service_error",false).synthesize("你好。","tide")).isInstanceOf(ApiException.class).hasMessageContaining("失败");handled.get();}
    @Test void rejectsTruncatedWav(){assertThatThrownBy(()->SpeechProvider.decode(Arrays.copyOf(SpeechTest.wav(),100))).isInstanceOf(ApiException.class).hasMessageContaining("不完整");}
    @Test void onlyAutoReusesDeepSeekConfiguration(){
        assertThat(new SpeechProvider("","https://api.deepseek.com","key","https://api.openai.com/v1",new ObjectMapper()).configured()).isFalse();
        assertThat(new SpeechProvider("","https://api.deepseek.com","key","https://api.deepseek.com/v1",new ObjectMapper()).configured()).isTrue();
    }
}
