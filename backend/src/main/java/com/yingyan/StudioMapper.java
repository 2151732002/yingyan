package com.yingyan;

import com.yingyan.Models.*;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface StudioMapper {
    @Select("SELECT * FROM app_user WHERE username=#{name}") User user(String name);
    @Insert("INSERT INTO app_user(id,username,password_hash) VALUES(#{id},#{username},#{passwordHash})") void addUser(User user);
    @Insert("INSERT INTO user_session(token_hash,owner_id,expires_at) VALUES(#{hash},#{owner},#{expires})")
    void session(@Param("hash")String hash,@Param("owner")String owner,@Param("expires")LocalDateTime expires);
    @Select("SELECT u.* FROM user_session s JOIN app_user u ON u.id=s.owner_id WHERE s.token_hash=#{hash} AND s.expires_at>CURRENT_TIMESTAMP") User sessionUser(String hash);
    @Delete("DELETE FROM user_session WHERE token_hash=#{hash}") void logout(String hash);
    @Delete("DELETE FROM user_session WHERE expires_at<CURRENT_TIMESTAMP") void pruneSessions();
    @Select("SELECT * FROM story_project WHERE owner_id=#{owner} AND archived=#{archived} ORDER BY updated_at DESC,id DESC LIMIT 100")
    List<ProjectRow> projects(@Param("owner")String owner,@Param("archived")boolean archived);
    @Select("SELECT * FROM story_project WHERE id=#{id} AND owner_id=#{owner}") ProjectRow project(@Param("id")String id,@Param("owner")String owner);
    @Insert("INSERT INTO story_project(id,owner_id,title,logline,genre,target_duration,revision,archived,document_json) VALUES(#{id},#{ownerId},#{title},#{logline},#{genre},#{targetDuration},1,FALSE,#{documentJson})")
    void create(ProjectRow row);
    @Update("UPDATE story_project SET title=#{title},logline=#{logline},genre=#{genre},target_duration=#{targetDuration},revision=revision+1,archived=#{archived},document_json=#{documentJson},updated_at=CURRENT_TIMESTAMP WHERE id=#{id} AND owner_id=#{ownerId} AND revision=#{revision}")
    int update(ProjectRow row);
    @Insert("INSERT INTO story_revision(project_id,revision,snapshot_json,summary) VALUES(#{projectId},#{revision},#{snapshotJson},#{summary})") void insertRevision(RevisionRow row);
    @Select("SELECT * FROM story_revision WHERE project_id=#{id} ORDER BY revision DESC LIMIT 100") List<RevisionRow> revisions(String id);
    @Select("SELECT * FROM story_revision WHERE project_id=#{id} AND revision=#{revision}") RevisionRow revision(@Param("id")String id,@Param("revision")int revision);
    @Insert("INSERT INTO story_asset(id,project_id,owner_id,file_name,storage_key,mime_type,size_bytes,width,height) VALUES(#{id},#{projectId},#{ownerId},#{fileName},#{storageKey},#{mimeType},#{sizeBytes},#{width},#{height})") void insertAsset(Asset asset);
    @Select("SELECT * FROM story_asset WHERE id=#{id} AND owner_id=#{owner}") Asset asset(@Param("id")String id,@Param("owner")String owner);
    @Select("SELECT * FROM story_asset WHERE project_id=#{id} AND owner_id=#{owner} ORDER BY created_at DESC") List<Asset> assets(@Param("id")String id,@Param("owner")String owner);
}
