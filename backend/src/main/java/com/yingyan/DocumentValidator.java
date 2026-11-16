package com.yingyan;

import com.yingyan.Models.Document;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class DocumentValidator {
    private final Validator bean;
    private final StudioMapper mapper;
    public DocumentValidator(Validator bean,StudioMapper mapper){this.bean=bean;this.mapper=mapper;}
    public void validate(Document document,String projectId,String owner){
        if(document==null||!bean.validate(document).isEmpty())throw ApiException.bad("剧本字段、镜头数量或角色数量超出首版范围");
        Set<String> characters=new HashSet<>(),scenes=new HashSet<>(),shots=new HashSet<>(),lines=new HashSet<>();
        for(var c:document.characters()){
            if(c==null)throw ApiException.bad("角色不能为空");unique(characters,c.id(),"角色");
            if(!c.referenceAssetId().isBlank()){
                var asset=mapper.asset(c.referenceAssetId(),owner);
                if(asset==null||!asset.projectId().equals(projectId))throw ApiException.bad("角色参考图不属于当前项目");
            }
        }
        for(var scene:document.scenes()){
            if(scene==null)throw ApiException.bad("场景不能为空");unique(scenes,scene.id(),"场景");
        }
        for(var shot:document.shots()){
            if(shot==null)throw ApiException.bad("镜头不能为空");unique(shots,shot.id(),"镜头");
            if(!scenes.contains(shot.sceneId()))throw ApiException.bad("镜头引用了不存在的场景");
            Set<String> visible=new HashSet<>(shot.visibleCharacterIds());
            if(visible.size()!=shot.visibleCharacterIds().size()||!characters.containsAll(visible))throw ApiException.bad("镜头的出场角色不合法");
            var line=shot.dialogue();
            if(line!=null){
                unique(lines,line.id(),"台词");
                if(!characters.contains(line.speakerId()))throw ApiException.bad("台词的说话角色不存在");
                if(line.delivery().equals("ON_SCREEN")&&!visible.contains(line.speakerId()))throw ApiException.bad("画面内对白的说话人必须出现在镜头中");
            }
            if(shot.kind().equals("DIALOGUE")&&line==null)throw ApiException.bad("对白镜头需要绑定一位说话人");
        }
    }
    private void unique(Set<String> ids,String id,String label){
        if(id==null||!id.matches("[a-zA-Z0-9_-]{1,64}")||!ids.add(id))throw ApiException.bad(label+"编号不合法或重复");
    }
}
