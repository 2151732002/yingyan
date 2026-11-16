package com.yingyan;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.*;

@Component
public class AuthFilter extends OncePerRequestFilter {
    private final AuthService auth;
    private final Set<String> origins;
    public AuthFilter(AuthService auth,@Value("${yingyan.allowed-origins:http://127.0.0.1:3100,http://localhost:3100}")String origins){this.auth=auth;this.origins=new HashSet<>(Arrays.asList(origins.split(",")));}
    public static String token(HttpServletRequest req){if(req.getCookies()!=null)for(var c:req.getCookies())if(c.getName().equals("yingyan_session"))return c.getValue();return null;}
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException {
        if(!req.getRequestURI().startsWith("/api/")){chain.doFilter(req,res);return;}
        res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
        if(!Set.of("GET","HEAD","OPTIONS").contains(req.getMethod())){
            String origin=req.getHeader("Origin");
            if("cross-site".equals(req.getHeader("Sec-Fetch-Site"))||(origin!=null&&!origins.contains(origin))){error(res,403,"CROSS_SITE_REQUEST","不允许跨站提交请求");return;}
        }
        String path=req.getRequestURI();
        if(path.equals("/api/auth/login")||path.equals("/api/system")){chain.doFilter(req,res);return;}
        var user=auth.user(token(req));
        if(user==null){error(res,401,"UNAUTHENTICATED","请先登录映言");return;}
        req.setAttribute("user",user);chain.doFilter(req,res);
    }
    private void error(HttpServletResponse res,int status,String code,String message)throws IOException{
        res.setStatus(status);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"code\":\""+code+"\",\"message\":\""+message+"\"}");
    }
}
