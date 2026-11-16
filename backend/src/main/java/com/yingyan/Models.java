package com.yingyan;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public final class Models {
    private Models(){}
    public record User(String id,String username,@JsonIgnore String passwordHash,LocalDateTime createdAt){}
    public record Login(@NotBlank @Size(max=64) String username,@NotBlank @Size(max=200) String password){}
    public record Character(@NotBlank @Size(max=64) String id,@NotBlank @Size(max=60) String name,
        @NotNull @Size(max=1000) String description,@NotNull @Size(max=1000) String appearance,
        @NotNull @Size(max=500) String costume,@NotNull @Size(max=100) String voiceId,@NotNull @Size(max=64) String referenceAssetId){}
    public record Scene(@NotBlank @Size(max=64) String id,@NotBlank @Size(max=100) String name,
        @NotNull @Size(max=2000) String description,@NotNull @Size(max=500) String lighting,@NotNull @Size(max=1000) String blocking){}
    public record Dialogue(@NotBlank @Size(max=64) String id,@NotBlank @Size(max=64) String speakerId,
        @NotNull @Size(max=1000) String text,@NotNull @Size(max=200) String emotion,
        @DecimalMin("0.5") @DecimalMax("2.0") double speed,@Pattern(regexp="ON_SCREEN|VOICE_OVER") @NotNull String delivery){}
    public record Shot(@NotBlank @Size(max=64) String id,@NotBlank @Size(max=64) String sceneId,
        @NotBlank @Size(max=120) String title,@Pattern(regexp="DIALOGUE|REACTION|ESTABLISHING") @NotNull String kind,
        @Pattern(regexp="CLOSEUP|MEDIUM|WIDE|OVER_SHOULDER") @NotNull String framing,
        @NotNull @Size(max=2000) String description,@NotNull @Size(max=2) List<@NotBlank String> visibleCharacterIds,
        @DecimalMin("0.5") @DecimalMax("20") double durationSeconds,@Valid Dialogue dialogue){}
    public record Document(@NotNull @Size(max=30000) String story,@NotNull @Size(max=30000) String script,
        @NotNull @Size(max=2) List<@Valid Character> characters,@NotNull @Size(max=4) List<@Valid Scene> scenes,
        @NotNull @Size(max=12) List<@Valid Shot> shots) {
        public static Document empty(){return new Document("","",List.of(),List.of(),List.of());}
    }
    public record CreateProject(@NotBlank @Size(max=120) String title,@NotNull @Size(max=1000) String logline,
        @NotBlank @Size(max=40) String genre,@Min(10) @Max(60) int targetDuration){}
    public record SaveProject(@Min(1) int expectedRevision,@NotBlank @Size(max=120) String title,
        @NotNull @Size(max=1000) String logline,@NotBlank @Size(max=40) String genre,@Min(10) @Max(60) int targetDuration,
        @NotNull @Valid Document document,@NotBlank @Size(max=200) String summary){}
    public record RevisionRequest(@Min(1) int expectedRevision){}
    public record RestoreRequest(@Min(1) int expectedRevision,@Min(1) int sourceRevision){}
    public record SuggestionRequest(@NotBlank @Size(max=5000) String prompt,@Min(1) int expectedRevision){}
    public record ProjectRow(String id,String ownerId,String title,String logline,String genre,int targetDuration,
        int revision,boolean archived,String documentJson,LocalDateTime createdAt,LocalDateTime updatedAt){}
    public record Snapshot(String title,String logline,String genre,int targetDuration,Document document){}
    public record Project(String id,String title,String logline,String genre,int targetDuration,int revision,
        boolean archived,Document document,LocalDateTime createdAt,LocalDateTime updatedAt){}
    public record RevisionRow(String projectId,int revision,String snapshotJson,String summary,LocalDateTime createdAt){}
    public record Revision(int revision,String title,String logline,String genre,int targetDuration,Document document,
        String summary,LocalDateTime createdAt){}
    public record Asset(String id,String projectId,@JsonIgnore String ownerId,String fileName,@JsonIgnore String storageKey,
        String mimeType,long sizeBytes,int width,int height,LocalDateTime createdAt) {
        @JsonProperty public String url(){return "/api/assets/"+id+"/file";}
    }
}
