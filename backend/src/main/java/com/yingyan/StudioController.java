package com.yingyan;

import com.yingyan.Models.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api")
public class StudioController {
    private final AuthService auth;private final ProjectService projects;private final AssetService assets;
    private final StudioMapper mapper;private final AiPlanner ai;private final DocumentValidator validator;private final boolean secure;
    public StudioController(AuthService auth,ProjectService projects,AssetService assets,StudioMapper mapper,AiPlanner ai,DocumentValidator validator,@Value("${yingyan.cookie-secure:false}")boolean secure){
        this.auth=auth;this.projects=projects;this.assets=assets;this.mapper=mapper;this.ai=ai;this.validator=validator;this.secure=secure;
    }
    private User user(HttpServletRequest req){return (User)req.getAttribute("user");}
    @GetMapping("/system") public Map<String,Object> system(){return Map.of("name","映言","stage",1,"aiConfigured",ai.configured(),"textModel",ai.model(),"videoGenerationAvailable",false);}
    @PostMapping("/auth/login") public ResponseEntity<?> login(HttpServletRequest req,@Valid @RequestBody Login body){
        String token=auth.login(body.username(),body.password());auth.logout(AuthFilter.token(req));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE,cookie(token,Duration.ofDays(7)).toString()).body(auth.user(token));
    }
    @GetMapping("/auth/session") public User session(HttpServletRequest req){return user(req);}
    @PostMapping("/auth/logout") public ResponseEntity<?> logout(HttpServletRequest req){auth.logout(AuthFilter.token(req));return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,cookie("",Duration.ZERO).toString()).build();}
    private ResponseCookie cookie(String token,Duration age){return ResponseCookie.from("yingyan_session",token).httpOnly(true).secure(secure).sameSite("Lax").path("/").maxAge(age).build();}
    @GetMapping("/projects") public List<Project> list(HttpServletRequest req,@RequestParam(defaultValue="false")boolean archived){return projects.list(user(req).id(),archived);}
    @PostMapping("/projects") @ResponseStatus(HttpStatus.CREATED) public Project create(HttpServletRequest req,@Valid @RequestBody CreateProject body){return projects.create(user(req).id(),body);}
    @GetMapping("/projects/{id}") public Project project(HttpServletRequest req,@PathVariable String id){return projects.get(user(req).id(),id);}
    @PutMapping("/projects/{id}") public Project save(HttpServletRequest req,@PathVariable String id,@Valid @RequestBody SaveProject body){return projects.save(user(req).id(),id,body);}
    @GetMapping("/projects/{id}/revisions") public List<Revision> revisions(HttpServletRequest req,@PathVariable String id){return projects.revisions(user(req).id(),id);}
    @GetMapping("/projects/{id}/revisions/{revision}") public Revision revision(HttpServletRequest req,@PathVariable String id,@PathVariable int revision){return projects.revision(user(req).id(),id,revision);}
    @PostMapping("/projects/{id}/restore") public Project restore(HttpServletRequest req,@PathVariable String id,@Valid @RequestBody RestoreRequest body){return projects.restore(user(req).id(),id,body);}
    @PostMapping("/projects/{id}/archive") public Project archive(HttpServletRequest req,@PathVariable String id,@Valid @RequestBody RevisionRequest body){return projects.archive(user(req).id(),id,body.expectedRevision(),true);}
    @PostMapping("/projects/{id}/unarchive") public Project unarchive(HttpServletRequest req,@PathVariable String id,@Valid @RequestBody RevisionRequest body){return projects.archive(user(req).id(),id,body.expectedRevision(),false);}
    @GetMapping("/projects/{id}/assets") public List<Asset> assets(HttpServletRequest req,@PathVariable String id){projects.owned(user(req).id(),id);return mapper.assets(id,user(req).id());}
    @PostMapping("/projects/{id}/assets") @ResponseStatus(HttpStatus.CREATED) public Asset upload(HttpServletRequest req,@PathVariable String id,@RequestParam("file")MultipartFile file)throws IOException{return assets.upload(user(req).id(),id,file);}
    @GetMapping("/assets/{id}/file") public ResponseEntity<?> file(HttpServletRequest req,@PathVariable String id){
        var asset=assets.owned(user(req).id(),id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.mimeType()))
            .header(HttpHeaders.CONTENT_DISPOSITION,"inline").body(new FileSystemResource(assets.path(asset.storageKey())));
    }
    @PostMapping("/projects/{id}/draft-suggestions") public Map<String,Object> suggest(HttpServletRequest req,@PathVariable String id,@Valid @RequestBody SuggestionRequest body){
        String owner=user(req).id();var p=projects.get(owner,id);if(p.revision()!=body.expectedRevision())throw ApiException.conflict();
        var document=ai.suggest(body.prompt(),p);validator.validate(document,id,owner);
        return Map.of("baseRevision",p.revision(),"document",document,"model",ai.model());
    }
}
