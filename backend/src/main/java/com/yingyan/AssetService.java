package com.yingyan;

import com.yingyan.Models.Asset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AssetService {
    private final StudioMapper mapper;
    private final ProjectService projects;
    private final Path root;
    public AssetService(StudioMapper mapper,ProjectService projects,@Value("${yingyan.storage}")String path)throws IOException{
        this.mapper=mapper;this.projects=projects;root=Path.of(path).toAbsolutePath().normalize();Files.createDirectories(root);
    }
    public Asset upload(String owner,String projectId,MultipartFile file)throws IOException {
        var project=projects.owned(owner,projectId);if(project.archived())throw ApiException.bad("归档项目不能添加素材");
        if(file.isEmpty()||file.getSize()>5242880||!Set.of("image/png","image/jpeg").contains(Objects.toString(file.getContentType(),"")))throw ApiException.bad("请上传不超过 5MB 的 JPEG 或 PNG 图片");
        byte[] bytes=file.getBytes();String format;int width,height;
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
            var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw ApiException.bad("文件不是有效图片");
            var reader=readers.next();try{
                reader.setInput(stream);format=reader.getFormatName().toLowerCase(Locale.ROOT);width=reader.getWidth(0);height=reader.getHeight(0);
                if(!Set.of("jpeg","png").contains(format)||(long)width*height>20_000_000||width<1||height<1)throw ApiException.bad("图片格式不合法或超过 2000 万像素");
                reader.read(0);
            }finally{reader.dispose();}
        }catch(ApiException e){throw e;}catch(IOException|RuntimeException e){throw ApiException.bad("图片损坏，无法解码");}
        String mime=format.equals("png")?"image/png":"image/jpeg";
        if(!mime.equals(file.getContentType()))throw ApiException.bad("文件类型与实际图片格式不一致");
        String id=UUID.randomUUID().toString(),key=id+(format.equals("png")?".png":".jpg");
        String name=Objects.toString(file.getOriginalFilename(),"reference").replaceAll("[\\\\/\\p{Cntrl}]","_");if(name.length()>200)name=name.substring(name.length()-200);
        Files.write(path(key),bytes,StandardOpenOption.CREATE_NEW);
        var asset=new Asset(id,projectId,owner,name,key,mime,bytes.length,width,height,LocalDateTime.now());
        try{mapper.insertAsset(asset);}catch(RuntimeException e){Files.deleteIfExists(path(key));throw e;}
        return asset;
    }
    public Asset owned(String owner,String id){var a=mapper.asset(id,owner);if(a==null)throw ApiException.missing();return a;}
    public Path path(String key){if(key==null||!key.matches("[a-f0-9-]+\\.(png|jpg)"))throw ApiException.missing();Path p=root.resolve(key).normalize();if(!p.startsWith(root))throw ApiException.missing();return p;}
}
