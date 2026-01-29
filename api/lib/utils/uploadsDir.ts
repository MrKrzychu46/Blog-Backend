import fs from 'fs';
import path from 'path';

export function getUploadsRootDir(): string {
    // Render persistent disk mount
    const renderMount = '/uploads';

    // Jeśli istnieje /uploads -> używamy jego (Render)
    if (fs.existsSync(renderMount)) return renderMount;

    // Lokalnie / bez mount -> używamy katalogu w projekcie
    return path.join(process.cwd(), 'uploads');
}
