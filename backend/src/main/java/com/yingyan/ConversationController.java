package com.yingyan;

import com.yingyan.Models.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{id}/conversation")
public class ConversationController {
    private final ConversationService conversations;
    public ConversationController(ConversationService conversations){this.conversations=conversations;}
    private String owner(HttpServletRequest request){return ((User)request.getAttribute("user")).id();}
    @GetMapping public Conversation get(HttpServletRequest request,@PathVariable String id){return conversations.get(owner(request),id);}
    @PutMapping("/memory") public Conversation memory(HttpServletRequest request,@PathVariable String id,@Valid @RequestBody MemoryUpdate body){return conversations.editMemory(owner(request),id,body);}
    @PostMapping("/turns") public Conversation turn(HttpServletRequest request,@PathVariable String id,@Valid @RequestBody ChatRequest body){return conversations.turn(owner(request),id,body);}
    @PostMapping("/save") public ConversationSaved save(HttpServletRequest request,@PathVariable String id,@Valid @RequestBody ChatVersion body){return conversations.save(owner(request),id,body);}
    @PostMapping("/rebase") public ConversationSaved rebase(HttpServletRequest request,@PathVariable String id,@Valid @RequestBody ChatVersion body){return conversations.rebase(owner(request),id,body);}
}
