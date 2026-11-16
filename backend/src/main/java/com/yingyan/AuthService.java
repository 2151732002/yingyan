package com.yingyan;

import com.yingyan.Models.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AuthService {
    private final StudioMapper mapper;
    private final String adminName,adminPassword;
    private final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder();
    private final SecureRandom random=new SecureRandom();
    private final String dummyHash=passwords.encode("not-a-real-account-password");
    public AuthService(StudioMapper mapper,@Value("${yingyan.admin-username:director}")String name,@Value("${yingyan.admin-password:}")String password){this.mapper=mapper;adminName=name;adminPassword=password;}
    @EventListener(ApplicationReadyEvent.class) public void bootstrap(){
        if(!adminPassword.isBlank()&&mapper.user(adminName)==null){
            if(adminPassword.length()<12)throw new IllegalStateException("YINGYAN_ADMIN_PASSWORD must contain at least 12 characters");
            mapper.addUser(new User(UUID.randomUUID().toString(),adminName,passwords.encode(adminPassword),null));
        }
        mapper.pruneSessions();
    }
    public String login(String name,String password){
        var user=mapper.user(name);
        boolean valid=passwords.matches(password,user==null?dummyHash:user.passwordHash());
        if(user==null||!valid)throw new ApiException(401,"INVALID_CREDENTIALS","账号或密码不正确");
        byte[] bytes=new byte[32];random.nextBytes(bytes);String token=HexFormat.of().formatHex(bytes);
        mapper.session(hash(token),user.id(),LocalDateTime.now().plusDays(7));return token;
    }
    public User user(String token){return token!=null&&token.matches("[a-f0-9]{64}")?mapper.sessionUser(hash(token)):null;}
    public void logout(String token){if(token!=null)mapper.logout(hash(token));}
    private String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
