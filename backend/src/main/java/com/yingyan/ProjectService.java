package com.yingyan;

import com.yingyan.Models.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ProjectService {
    private final StudioMapper mapper;
    private final ObjectMapper json;
    private final DocumentValidator validator;
    public ProjectService(StudioMapper mapper,ObjectMapper json,DocumentValidator validator){this.mapper=mapper;this.json=json;this.validator=validator;}
    public List<Project> list(String owner,boolean archived){return mapper.projects(owner,archived).stream().map(this::view).toList();}
    public ProjectRow owned(String owner,String id){var row=mapper.project(id,owner);if(row==null)throw ApiException.missing();return row;}
    public Project get(String owner,String id){return view(owned(owner,id));}
    @Transactional public Project create(String owner,CreateProject request){
        String id=UUID.randomUUID().toString();
        mapper.create(new ProjectRow(id,owner,request.title().trim(),request.logline(),request.genre(),request.targetDuration(),1,false,write(Document.empty()),null,null));
        var row=owned(owner,id);snapshot(row,"创建项目");return view(row);
    }
    @Transactional public Project save(String owner,String id,SaveProject request){
        var row=owned(owner,id);if(row.archived())throw new ApiException(409,"PROJECT_ARCHIVED","请先重新启用项目再编辑");
        validator.validate(request.document(),id,owner);
        return commit(new ProjectRow(id,owner,request.title().trim(),request.logline(),request.genre(),request.targetDuration(),request.expectedRevision(),false,write(request.document()),row.createdAt(),row.updatedAt()),request.summary());
    }
    @Transactional public Project archive(String owner,String id,int expected,boolean archived){
        var row=owned(owner,id);
        return commit(new ProjectRow(id,owner,row.title(),row.logline(),row.genre(),row.targetDuration(),expected,archived,row.documentJson(),row.createdAt(),row.updatedAt()),archived?"归档项目":"重新启用项目");
    }
    @Transactional public Project restore(String owner,String id,RestoreRequest request){
        var current=owned(owner,id);var old=revision(owner,id,request.sourceRevision());
        return commit(new ProjectRow(id,owner,old.title(),old.logline(),old.genre(),old.targetDuration(),request.expectedRevision(),false,write(old.document()),current.createdAt(),current.updatedAt()),"从 V"+request.sourceRevision()+" 恢复草稿");
    }
    public List<Revision> revisions(String owner,String id){owned(owner,id);return mapper.revisions(id).stream().map(this::revisionView).toList();}
    public Revision revision(String owner,String id,int revision){owned(owner,id);var row=mapper.revision(id,revision);if(row==null)throw ApiException.missing();return revisionView(row);}
    private Project commit(ProjectRow next,String summary){
        if(mapper.update(next)!=1)throw ApiException.conflict();
        var saved=owned(next.ownerId(),next.id());snapshot(saved,summary);return view(saved);
    }
    private void snapshot(ProjectRow row,String summary){
        mapper.insertRevision(new RevisionRow(row.id(),row.revision(),write(new Snapshot(row.title(),row.logline(),row.genre(),row.targetDuration(),read(row.documentJson(),Document.class))),summary,null));
    }
    private Project view(ProjectRow row){return new Project(row.id(),row.title(),row.logline(),row.genre(),row.targetDuration(),row.revision(),row.archived(),read(row.documentJson(),Document.class),row.createdAt(),row.updatedAt());}
    private Revision revisionView(RevisionRow row){var s=read(row.snapshotJson(),Snapshot.class);return new Revision(row.revision(),s.title(),s.logline(),s.genre(),s.targetDuration(),s.document(),row.summary(),row.createdAt());}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException("Cannot encode project",e);}}
    private <T>T read(String value,Class<T> type){try{return json.readValue(value,type);}catch(JsonProcessingException e){throw new IllegalStateException("Cannot decode saved project",e);}}
}
