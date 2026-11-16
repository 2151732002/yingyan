package com.yingyan;

import com.yingyan.Models.MemoryRow;
import org.apache.ibatis.annotations.*;

@Mapper
public interface WritingMemoryMapper {
    @Select("SELECT * FROM story_writing_memory WHERE project_id=#{id} AND owner_id=#{owner}")
    MemoryRow get(@Param("id")String id,@Param("owner")String owner);
    @Insert("INSERT INTO story_writing_memory(project_id,owner_id,requirements_json,summary,suggestions_json,revoked_json) VALUES(#{projectId},#{ownerId},#{requirementsJson},#{summary},#{suggestionsJson},#{revokedJson})")
    void create(MemoryRow row);
    @Update("UPDATE story_writing_memory SET requirements_json=#{requirementsJson},summary=#{summary},suggestions_json=#{suggestionsJson},revoked_json=#{revokedJson},updated_at=CURRENT_TIMESTAMP WHERE project_id=#{projectId} AND owner_id=#{ownerId}")
    int update(MemoryRow row);
}
