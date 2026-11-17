package com.sharehub;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Component
class Media {
    private final Path root;

    Media(@Value("${sharehub.media}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    String save(MultipartFile image) {
        try (InputStream stream = image.getInputStream()) {
            Files.createDirectories(root);
            try (var input = new java.io.BufferedInputStream(stream)) {
                input.mark(12);
                String extension = extension(input.readNBytes(12));
                input.reset();
                String name = UUID.randomUUID() + "." + extension;
                try {
                    Files.copy(input, root.resolve(name));
                } catch (IOException error) {
                    delete(name);
                    throw error;
                }
                return name;
            }
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "图片保存失败", error);
        }
    }

    private String extension(byte[] bytes) {
        if (bytes.length >= 12) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10) return "png";
            if (bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff) return "jpeg";
            if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return "webp";
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择 PNG、JPEG 或 WebP 图片");
    }

    Path file(String name) {
        if (!name.matches("[a-f0-9-]{36}\\.(png|jpeg|webp)") || !Files.isRegularFile(root.resolve(name))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return root.resolve(name);
    }

    void delete(String name) {
        try {
            Files.deleteIfExists(root.resolve(name));
        } catch (IOException error) {
            org.slf4j.LoggerFactory.getLogger(Media.class).warn("Could not remove image {}", name, error);
        }
    }
}
