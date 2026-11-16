package com.yingyan;

import com.yingyan.Models.*;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;

@Mapper
public interface ConversationMapper {
    @Select("SELECT * FROM story_conversation WHERE project_id=#{id} AND owner_id=#{owner}")
    ConversationRow get(@Param("id")String id,@Param("owner")String owner);
    @Select("SELECT * FROM story_project WHERE id=#{id} AND owner_id=#{owner} FOR UPDATE")
    ProjectRow lockProject(@Param("id")String id,@Param("owner")String owner);
    @Insert("INSERT INTO story_conversation(project_id,owner_id,version,base_revision,draft_json,messages_json) VALUES(#{projectId},#{ownerId},1,#{baseRevision},#{draftJson},#{messagesJson})")
    void create(ConversationRow row);
    @Update("UPDATE story_conversation SET request_id=#{request},pending_prompt=#{prompt},processing_until=#{until},updated_at=CURRENT_TIMESTAMP WHERE project_id=#{id} AND owner_id=#{owner} AND version=#{version} AND (processing_until IS NULL OR processing_until<CURRENT_TIMESTAMP)")
    int acquire(@Param("id")String id,@Param("owner")String owner,@Param("version")int version,@Param("request")String request,@Param("prompt")String prompt,@Param("until")LocalDateTime until);
    @Update("UPDATE story_conversation SET draft_json=#{draft},messages_json=#{messages},version=version+1,request_id=NULL,pending_prompt=NULL,processing_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE project_id=#{id} AND owner_id=#{owner} AND version=#{version} AND request_id=#{request}")
    int finish(@Param("id")String id,@Param("owner")String owner,@Param("version")int version,@Param("request")String request,@Param("draft")String draft,@Param("messages")String messages);
    @Update("UPDATE story_conversation SET request_id=NULL,processing_until=NULL WHERE project_id=#{id} AND owner_id=#{owner} AND request_id=#{request}")
    int release(@Param("id")String id,@Param("owner")String owner,@Param("request")String request);
    @Update("UPDATE story_conversation SET base_revision=#{base},draft_json=#{draft},messages_json=#{messages},version=version+1,request_id=NULL,pending_prompt=NULL,processing_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE project_id=#{id} AND owner_id=#{owner} AND version=#{version} AND (processing_until IS NULL OR processing_until<CURRENT_TIMESTAMP)")
    int sync(@Param("id")String id,@Param("owner")String owner,@Param("version")int version,@Param("base")int base,@Param("draft")String draft,@Param("messages")String messages);
}
