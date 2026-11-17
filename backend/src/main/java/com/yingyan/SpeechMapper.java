package com.yingyan;

import com.yingyan.SpeechModels.*;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SpeechMapper {
    @Select("SELECT * FROM story_voice_binding WHERE project_id=#{projectId}") List<Binding> bindings(String projectId);
    @Select("SELECT * FROM story_voice_binding WHERE project_id=#{projectId} AND character_id=#{characterId}") Binding binding(@Param("projectId")String projectId,@Param("characterId")String characterId);
    @Insert("INSERT INTO story_voice_binding(project_id,character_id,voice_id,version) VALUES(#{projectId},#{characterId},#{voiceId},1)") void insertBinding(Binding value);
    @Update("UPDATE story_voice_binding SET voice_id=#{voiceId},version=version+1 WHERE project_id=#{projectId} AND character_id=#{characterId} AND version=#{version}") int updateBinding(Binding value);
    @Insert("INSERT INTO story_speech_job(id,project_id,owner_id,shot_id,dialogue_id,character_id,character_name,text,emotion,speed,voice_id,project_revision,fingerprint,status,error_message,storage_key,duration_seconds,created_at,updated_at) VALUES(#{id},#{projectId},#{ownerId},#{shotId},#{dialogueId},#{characterId},#{characterName},#{text},#{emotion},#{speed},#{voiceId},#{projectRevision},#{fingerprint},'QUEUED','','',0,#{createdAt},#{updatedAt})") void insert(Job value);
    @Select("SELECT * FROM story_speech_job WHERE project_id=#{projectId} AND owner_id=#{ownerId} ORDER BY created_at DESC,id DESC LIMIT 200") List<Job> jobs(@Param("projectId")String projectId,@Param("ownerId")String ownerId);
    @Select("SELECT * FROM story_speech_job WHERE id=#{id} AND owner_id=#{ownerId}") Job owned(@Param("id")String id,@Param("ownerId")String ownerId);
    @Select("SELECT COUNT(*) FROM story_speech_job WHERE project_id=#{projectId} AND status IN ('QUEUED','RUNNING')") int active(String projectId);
    @Select("SELECT COUNT(*) FROM story_speech_job WHERE project_id=#{projectId} AND shot_id=#{shotId} AND status IN ('QUEUED','RUNNING')") int activeLine(@Param("projectId")String projectId,@Param("shotId")String shotId);
    @Select("SELECT * FROM story_speech_job WHERE status='QUEUED' ORDER BY created_at,id LIMIT 1") Job next();
    @Update("UPDATE story_speech_job SET status='RUNNING',claim_token=#{token},lease_until=#{until},updated_at=CURRENT_TIMESTAMP WHERE id=#{id} AND status='QUEUED'") int claim(@Param("id")String id,@Param("token")String token,@Param("until")LocalDateTime until);
    @Update("UPDATE story_speech_job SET status=#{status},error_message=#{error},storage_key=#{key},duration_seconds=#{duration},lease_until=NULL,claim_token=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=#{id} AND status='RUNNING' AND claim_token=#{token}") int finish(@Param("id")String id,@Param("token")String token,@Param("status")String status,@Param("error")String error,@Param("key")String key,@Param("duration")double duration);
    @Update("UPDATE story_speech_job SET status='FAILED',error_message='任务执行中断，请确认后手动重做',claim_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE status='RUNNING' AND lease_until < #{now}") int expire(LocalDateTime now);
}
