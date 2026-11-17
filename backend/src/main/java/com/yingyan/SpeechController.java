package com.yingyan;

import com.yingyan.Models.User;
import com.yingyan.SpeechModels.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SpeechController {
    private final SpeechService speech;private final SpeechWorker worker;
    public SpeechController(SpeechService speech,SpeechWorker worker){this.speech=speech;this.worker=worker;}
    private String owner(HttpServletRequest req){return ((User)req.getAttribute("user")).id();}
    @GetMapping("/projects/{id}/speech") public State state(HttpServletRequest r,@PathVariable String id){return speech.state(owner(r),id);}
    @PutMapping("/projects/{id}/speech/voices/{characterId}") public Binding bind(HttpServletRequest r,@PathVariable String id,@PathVariable String characterId,@Valid @RequestBody BindRequest body){return speech.bind(owner(r),id,characterId,body);}
    @PostMapping("/projects/{id}/speech/jobs") @ResponseStatus(HttpStatus.ACCEPTED) public JobView generate(HttpServletRequest r,@PathVariable String id,@Valid @RequestBody GenerateRequest body){return speech.generate(owner(r),id,body);}
    @PostMapping("/projects/{id}/speech/previews") @ResponseStatus(HttpStatus.ACCEPTED) public JobView preview(HttpServletRequest r,@PathVariable String id,@Valid @RequestBody PreviewRequest body){return speech.preview(owner(r),id,body);}
    @GetMapping("/speech/jobs/{id}/file") public ResponseEntity<?> file(HttpServletRequest r,@PathVariable String id){var job=speech.file(owner(r),id);return ResponseEntity.ok().contentType(MediaType.parseMediaType("audio/wav")).header(HttpHeaders.CONTENT_DISPOSITION,"inline").body(new FileSystemResource(worker.path(job.storageKey())));}
}
