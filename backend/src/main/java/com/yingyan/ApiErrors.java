package com.yingyan;

import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiException.class) ResponseEntity<?> business(ApiException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.code(),"message",e.getMessage()));}
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,MissingServletRequestPartException.class,MissingServletRequestParameterException.class,MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> invalid(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","请检查必填内容、字段长度、镜头数量和参数格式"));}
    @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<?> tooLarge(Exception e){return ResponseEntity.status(413).body(Map.of("code","FILE_TOO_LARGE","message","参考图片不能超过 5MB"));}
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e){
        LoggerFactory.getLogger(getClass()).error("Request failed",e);
        return ResponseEntity.internalServerError().body(Map.of("code","SERVER_ERROR","message","服务暂时不可用，请保留内容后重试"));
    }
}
