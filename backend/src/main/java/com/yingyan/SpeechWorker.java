package com.yingyan;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Component
@EnableScheduling
public class SpeechWorker {
    private final SpeechMapper mapper;private final SpeechProvider provider;private final Path root;private final boolean enabled;
    public SpeechWorker(SpeechMapper mapper,SpeechProvider provider,@Value("${yingyan.storage}")String storage,@Value("${yingyan.speech.worker-enabled:true}")boolean enabled)throws IOException{
        this.mapper=mapper;this.provider=provider;this.enabled=enabled;root=Path.of(storage).toAbsolutePath().normalize().resolve("speech");Files.createDirectories(root);
    }
    @Scheduled(fixedDelayString="${yingyan.speech.poll-ms:1000}") public void scheduled(){if(enabled)tick();}
    public void tick(){
        mapper.expire(LocalDateTime.now());var job=mapper.next();if(job==null)return;String token=UUID.randomUUID().toString();
        if(mapper.claim(job.id(),token,LocalDateTime.now().plusMinutes(3))!=1)return;
        Path file=null;
        try{var audio=provider.synthesize(job.text(),job.voiceId());String key=job.id()+".wav";file=path(key);Files.write(file,audio.bytes(),StandardOpenOption.CREATE_NEW);
            if(mapper.finish(job.id(),token,"SUCCEEDED","",key,audio.durationSeconds())!=1)Files.deleteIfExists(file);
        }catch(Exception e){if(file!=null)try{Files.deleteIfExists(file);}catch(IOException ignored){}
            // Never persist external exception bodies, input text or credentials in task diagnostics.
            String message=e instanceof ApiException a?a.getMessage():"语音任务执行失败，请稍后手动重试";
            mapper.finish(job.id(),token,"FAILED",message,"",0);
        }
    }
    public Path path(String key){if(key==null||!key.matches("[a-f0-9-]{36}\\.wav"))throw ApiException.missing();var p=root.resolve(key).normalize();if(!p.startsWith(root))throw ApiException.missing();return p;}
}
