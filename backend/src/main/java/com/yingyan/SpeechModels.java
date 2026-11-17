package com.yingyan;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public final class SpeechModels {
    private SpeechModels(){}
    public record Voice(String id,String name,String description){}
    public record Binding(String projectId,String characterId,String voiceId,int version){}
    public record BindRequest(@Min(1) int expectedRevision,@Min(0) int expectedVersion,@NotNull @Pattern(regexp="stella|tide") String voiceId){}
    public record GenerateRequest(@Min(1) int expectedRevision,@NotBlank @Size(max=64) String shotId,@Min(1) int expectedVoiceVersion){}
    public record PreviewRequest(@Min(1) int expectedRevision,@NotNull @Pattern(regexp="stella|tide") String voiceId){}
    public record Job(String id,String projectId,@JsonIgnore String ownerId,String shotId,String dialogueId,String characterId,String characterName,
        String text,String emotion,double speed,String voiceId,int projectRevision,String fingerprint,String status,
        String errorMessage,@JsonIgnore String storageKey,double durationSeconds,@JsonIgnore String claimToken,
        @JsonIgnore LocalDateTime leaseUntil,LocalDateTime createdAt,LocalDateTime updatedAt){}
    public record JobView(String id,String shotId,String dialogueId,String characterId,String characterName,String text,String emotion,
        double speed,String voiceId,int projectRevision,String status,String errorMessage,double durationSeconds,boolean stale,
        String url,LocalDateTime createdAt){}
    public record State(boolean configured,String provider,List<Voice> voices,List<Binding> bindings,List<JobView> jobs){}
}
