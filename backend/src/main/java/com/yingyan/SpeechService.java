package com.yingyan;

import com.yingyan.Models.*;
import com.yingyan.SpeechModels.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class SpeechService {
    private final SpeechMapper mapper;private final ConversationMapper locks;private final ProjectService projects;private final SpeechProvider provider;
    public SpeechService(SpeechMapper mapper,ConversationMapper locks,ProjectService projects,SpeechProvider provider){this.mapper=mapper;this.locks=locks;this.projects=projects;this.provider=provider;}
    private Project editable(String owner,String id,int revision){locks.lockProject(id,owner);var p=projects.get(owner,id);if(p.archived())throw ApiException.bad("请先重新启用项目");if(p.revision()!=revision)throw ApiException.conflict();return p;}
    public State state(String owner,String id){var p=projects.get(owner,id);var bindings=mapper.bindings(id);return new State(provider.configured(),"DeepSeek TTS",List.of(new Voice("stella","Stella · 女声","自然女声"),new Voice("tide","Tide · 男声","自然男声")),bindings,mapper.jobs(id,owner).stream().map(j->view(j,p,bindings)).toList());}
    @Transactional public Binding bind(String owner,String id,String characterId,BindRequest req){
        var p=editable(owner,id,req.expectedRevision());if(p.document().characters().stream().noneMatch(c->c.id().equals(characterId)))throw ApiException.missing();
        var old=mapper.binding(id,characterId);if((old==null?0:old.version())!=req.expectedVersion())throw new ApiException(409,"VOICE_CONFLICT","音色已在其他窗口更新，请刷新配音状态后再选择");
        var value=new Binding(id,characterId,req.voiceId(),req.expectedVersion());if(old==null)mapper.insertBinding(value);else if(mapper.updateBinding(value)!=1)throw ApiException.conflict();return mapper.binding(id,characterId);
    }
    @Transactional public JobView generate(String owner,String id,GenerateRequest req){
        var p=editable(owner,id,req.expectedRevision());var shot=p.document().shots().stream().filter(s->s.id().equals(req.shotId())).findFirst().orElseThrow(ApiException::missing);
        var line=shot.dialogue();if(line==null||line.text().isBlank())throw ApiException.bad("请先为这个镜头保存台词");
        if(line.speed()!=1)throw ApiException.bad("当前语音服务仅支持原速，请在分镜中将语速设为 1 并保存");
        var ch=p.document().characters().stream().filter(c->c.id().equals(line.speakerId())).findFirst().orElseThrow(ApiException::missing);
        var binding=mapper.binding(id,ch.id());if(binding==null)throw ApiException.bad("请先为说话角色选择并保存音色");
        if(binding.version()!=req.expectedVoiceVersion())throw new ApiException(409,"VOICE_CONFLICT","角色音色已更新，请刷新配音状态后再生成");
        return enqueue(owner,p,shot.id(),line.id(),ch.id(),ch.name(),line.text(),line.emotion(),line.speed(),binding.voiceId(),fingerprint(shot,binding.voiceId()));
    }
    @Transactional public JobView preview(String owner,String id,PreviewRequest req){var p=editable(owner,id,req.expectedRevision());return enqueue(owner,p,"preview-"+req.voiceId(),"","","音色试听","你好，这是我的声音。很高兴和你一起讲述这个故事。","",1,req.voiceId(),"");}
    private JobView enqueue(String owner,Project p,String shot,String dialogue,String character,String name,String text,String emotion,double speed,String voice,String fingerprint){
        if(!provider.configured())throw new ApiException(503,"SPEECH_NOT_CONFIGURED","尚未配置语音服务，请在后端配置 DeepSeek 语音 Key");
        if(mapper.activeLine(p.id(),shot)>0)throw new ApiException(409,"SPEECH_BUSY","这句台词已有任务，请等待完成后再重做");
        if(mapper.active(p.id())>=12)throw new ApiException(409,"SPEECH_QUEUE_FULL","当前项目待处理任务较多，请稍后再试");
        var now=LocalDateTime.now();var job=new Job(UUID.randomUUID().toString(),p.id(),owner,shot,dialogue,character,name,text,emotion,speed,voice,p.revision(),fingerprint,"QUEUED","","",0,null,null,now,now);mapper.insert(job);return view(job,p,mapper.bindings(p.id()));
    }
    private JobView view(Job j,Project p,List<Binding> bindings){
        boolean stale=false;if(!j.characterId().isEmpty()){
            var shot=p.document().shots().stream().filter(s->s.id().equals(j.shotId())).findFirst().orElse(null);
            var b=bindings.stream().filter(v->v.characterId().equals(j.characterId())).findFirst().orElse(null);
            stale=shot==null||b==null||!j.fingerprint().equals(fingerprint(shot,b.voiceId()));
        }
        return new JobView(j.id(),j.shotId(),j.dialogueId(),j.characterId(),j.characterName(),j.text(),j.emotion(),j.speed(),j.voiceId(),j.projectRevision(),j.status(),j.errorMessage(),j.durationSeconds(),stale,j.status().equals("SUCCEEDED")?"/api/speech/jobs/"+j.id()+"/file":"",j.createdAt());
    }
    static String fingerprint(Shot shot,String voice){
        if(shot.dialogue()==null)return "";var d=shot.dialogue();
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(String.join("\u0000",shot.id(),d.id(),d.speakerId(),d.text(),d.emotion(),Double.toString(d.speed()),voice).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}
    }
    public Job file(String owner,String id){var j=mapper.owned(id,owner);if(j==null)throw ApiException.missing();projects.owned(owner,j.projectId());if(!j.status().equals("SUCCEEDED"))throw new ApiException(409,"SPEECH_NOT_READY","音频尚未生成成功");return j;}
}
