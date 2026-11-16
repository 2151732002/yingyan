package com.yingyan;

public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    public ApiException(int status,String code,String message){super(message);this.status=status;this.code=code;}
    public int status(){return status;}
    public String code(){return code;}
    public static ApiException bad(String message){return new ApiException(400,"INVALID_INPUT",message);}
    public static ApiException missing(){return new ApiException(404,"NOT_FOUND","项目或素材不存在，或不属于当前账号");}
    public static ApiException conflict(){return new ApiException(409,"REVISION_CONFLICT","项目已有新版本。请保留当前内容，载入最新版本后再保存。");}
}
