package com.yingyan;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yingyan.Models.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ConversationService {
    private final ConversationMapper mapper;
    private final ProjectService projects;
    private final AiPlanner ai;
    private final DocumentValidator validator;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;
    public ConversationService(ConversationMapper mapper,ProjectService projects,AiPlanner ai,DocumentValidator validator,ObjectMapper json,TransactionTemplate transaction){
        this.mapper=mapper;this.projects=projects;this.ai=ai;this.validator=validator;this.json=json;this.transaction=transaction;
    }
    public Conversation get(String owner,String id){var p=projects.get(owner,id);return view(ensure(owner,p),p);}
    private ConversationRow ensure(String owner,Project p){
        var row=mapper.get(p.id(),owner);
        if(row==null){
            try{mapper.create(new ConversationRow(p.id(),owner,1,p.revision(),write(p.document()),"[]",null,null,null,null));}
            catch(DuplicateKeyException ignored){/* Another browser initialized the same project. */}
            row=mapper.get(p.id(),owner);
        }
        return row;
    }
    public Conversation turn(String owner,String id,ChatRequest request){
        var p=projects.get(owner,id);var row=ensure(owner,p);
        check(p,row,request.expectedVersion(),request.expectedRevision(),true);
        if(!ai.configured())throw new ApiException(503,"AI_NOT_CONFIGURED","文本辅助尚未连接，可以继续手动创作。");
        String requestId=UUID.randomUUID().toString();
        if(mapper.acquire(id,owner,row.version(),requestId,request.message(),LocalDateTime.now().plusSeconds(120))!=1)throw changed();
        try{
            var reply=ai.converse(request.message(),p,document(row),messages(row));
            if(reply==null||reply.reply()==null||reply.reply().isBlank()||reply.reply().length()>6000)throw new ApiException(502,"AI_INVALID_OUTPUT","AI 没有返回有效的创作回复，请保留输入后重试。");
            validator.validate(reply.document(),id,owner);
            var history=new ArrayList<>(messages(row));
            history.add(message("user",request.message()));history.add(message("assistant",reply.reply()));
            return transaction.execute(status->{
                lock(owner,id);var current=projects.get(owner,id);
                if(current.archived()||current.revision()!=p.revision())throw ApiException.conflict();
                if(mapper.finish(id,owner,row.version(),requestId,write(reply.document()),write(history))!=1)throw changed();
                return view(mapper.get(id,owner),current);
            });
        }finally{mapper.release(id,owner,requestId);}
    }
    public ConversationSaved save(String owner,String id,ChatVersion request){
        return transaction.execute(status->{
            lock(owner,id);var p=projects.get(owner,id);var row=ensure(owner,p);
            check(p,row,request.expectedVersion(),request.expectedRevision(),true);
            var draft=document(row);if(draft.equals(p.document()))throw ApiException.bad("这份剧本已保存，可以继续对话后再保存新版本。");
            var saved=projects.save(owner,id,new SaveProject(p.revision(),p.title(),p.logline(),p.genre(),p.targetDuration(),draft,"保存对话创作剧本"));
            if(mapper.sync(id,owner,row.version(),saved.revision(),row.draftJson(),row.messagesJson())!=1)throw changed();
            return new ConversationSaved(saved,view(mapper.get(id,owner),saved));
        });
    }
    public ConversationSaved rebase(String owner,String id,ChatVersion request){
        return transaction.execute(status->{
            lock(owner,id);var p=projects.get(owner,id);var row=ensure(owner,p);
            check(p,row,request.expectedVersion(),request.expectedRevision(),false);
            var history=new ArrayList<>(messages(row));history.add(message("assistant","已从最新保存的 V"+p.revision()+" 剧本继续。之前的对话仍保留，后续修改以当前草稿为准。"));
            if(mapper.sync(id,owner,row.version(),p.revision(),write(p.document()),write(history))!=1)throw changed();
            return new ConversationSaved(p,view(mapper.get(id,owner),p));
        });
    }
    private void lock(String owner,String id){if(mapper.lockProject(id,owner)==null)throw ApiException.missing();}
    private void check(Project p,ConversationRow row,int version,int revision,boolean requireBase){
        if(p.archived())throw new ApiException(409,"PROJECT_ARCHIVED","请先重新启用项目，再继续对话创作。");
        if(p.revision()!=revision||(requireBase&&row.baseRevision()!=revision))throw ApiException.conflict();
        if(row.version()!=version)throw changed();
        if(processing(row))throw new ApiException(409,"CHAT_BUSY","这一轮还在创作中，请等待结果或稍后刷新。");
    }
    private ApiException changed(){return new ApiException(409,"CHAT_CHANGED","对话已有新进展，请刷新对话后继续，当前输入仍可保留。");}
    private boolean processing(ConversationRow r){return r.processingUntil()!=null&&r.processingUntil().isAfter(LocalDateTime.now());}
    private ChatMessage message(String role,String content){return new ChatMessage(UUID.randomUUID().toString(),role,content,LocalDateTime.now());}
    private Conversation view(ConversationRow r,Project p){var d=document(r);return new Conversation(r.projectId(),r.version(),r.baseRevision(),p.revision(),d,messages(r),processing(r),Objects.toString(r.pendingPrompt(),""),r.baseRevision()!=p.revision(),!d.equals(p.document()),r.updatedAt());}
    private Document document(ConversationRow r){try{return json.readValue(r.draftJson(),Document.class);}catch(JsonProcessingException e){throw new IllegalStateException("Cannot decode conversation draft",e);}}
    private List<ChatMessage> messages(ConversationRow r){try{return json.readValue(r.messagesJson(),new TypeReference<List<ChatMessage>>(){});}catch(JsonProcessingException e){throw new IllegalStateException("Cannot decode conversation history",e);}}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException("Cannot encode conversation",e);}}
}
