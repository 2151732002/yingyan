package com.yingyan;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yingyan.Models.*;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class WritingMemoryService {
    private final WritingMemoryMapper mapper;
    private final ObjectMapper json;
    public WritingMemoryService(WritingMemoryMapper mapper,ObjectMapper json){this.mapper=mapper;this.json=json;}
    public WritingMemory get(String owner,String id){
        var row=mapper.get(id,owner);return row==null?WritingMemory.empty():new WritingMemory(read(row.requirementsJson()),row.summary(),read(row.suggestionsJson()),read(row.revokedJson()),row.updatedAt());
    }
    // Callers hold the project row lock and validate the conversation version.
    public void edit(String owner,String id,MemoryUpdate request){
        var old=get(owner,id);var requirements=clean(request.requirements());
        var revoked=new LinkedHashSet<>(old.revokedRequirements());
        for(String value:old.requirements())if(!requirements.contains(value))revoked.add(value);
        revoked.removeAll(requirements);
        var revocations=new ArrayList<>(revoked);
        if(revocations.size()>40)revocations=new ArrayList<>(revocations.subList(revocations.size()-40,revocations.size()));
        var suggestions=clean(request.suggestions()).stream().filter(s->!requirements.contains(s)&&!revoked.contains(s)).toList();
        store(owner,id,new WritingMemory(requirements,request.summary().strip(),suggestions,revocations,null));
    }
    public void propose(String owner,String id,MemoryProposal proposal){
        if(proposal==null||proposal.summary()==null||proposal.summary().length()>4000||proposal.suggestions()==null)return;
        var old=get(owner,id);
        var suggestions=proposal.suggestions().stream().filter(Objects::nonNull).map(String::strip).filter(s->!s.isBlank()&&s.length()<=300&&!old.requirements().contains(s)&&!old.revokedRequirements().contains(s)).distinct().limit(8).toList();
        String summary=proposal.summary().isBlank()?old.summary():proposal.summary().strip();
        store(owner,id,new WritingMemory(old.requirements(),summary,suggestions,old.revokedRequirements(),null));
    }
    private List<String> clean(List<String> values){return values.stream().map(String::strip).distinct().toList();}
    private void store(String owner,String id,WritingMemory memory){
        var row=new MemoryRow(id,owner,write(memory.requirements()),memory.summary(),write(memory.suggestions()),write(memory.revokedRequirements()),null);
        if(mapper.get(id,owner)==null)mapper.create(row);else if(mapper.update(row)!=1)throw ApiException.missing();
    }
    private List<String> read(String text){try{return json.readValue(text,new TypeReference<List<String>>(){});}catch(JsonProcessingException e){throw new IllegalStateException("Cannot decode writing memory",e);}}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException("Cannot encode writing memory",e);}}
}
