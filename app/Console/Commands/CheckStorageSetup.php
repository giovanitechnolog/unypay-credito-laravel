<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Diagnóstico (e reparo opcional) da configuração de storage do Laravel.
 *
 * Use no servidor quando uploads "funcionam local mas falham em produção" —
 * tipicamente é um dos sintomas abaixo:
 *
 *   • `public/storage` não é symlink → `php artisan storage:link` nunca
 *     rodou, ou o deploy descartou o link.
 *   • `storage/app/public/users/photos` não existe → o Flysystem normalmente
 *     cria sob demanda, mas com `open_basedir`, SELinux, ou perms 700 do
 *     dono do diretório-pai isso pode falhar silenciosamente.
 *   • Diretório existe mas o usuário do PHP (www-data / apache / nginx) não
 *     tem permissão de escrita.
 *
 * Uso:
 *   php artisan storage:check          # apenas diagnostica e relata
 *   php artisan storage:check --fix    # tenta reparar (cria link/dirs)
 */
class CheckStorageSetup extends Command
{
    protected $signature = 'storage:check {--fix : Tenta reparar problemas detectados (symlink, diretórios)}';

    protected $description = 'Diagnostica (e opcionalmente repara) a configuração de storage usada por uploads (fotos de usuário, PDFs de contrato, etc.).';

    public function handle(): int
    {
        $fix = (bool) $this->option('fix');
        $hasError = false;

        $this->newLine();
        $this->info('===== Diagnóstico de Storage =====');
        $this->line(' base_path   : ' . base_path());
        $this->line(' public_path : ' . public_path());
        $this->line(' storage_path: ' . storage_path());
        $this->newLine();

        $hasError = $this->checkSymlink($fix) || $hasError;
        $hasError = $this->checkDirectory('public', 'users/photos', $fix) || $hasError;
        $hasError = $this->checkDirectory('local',  'contracts/pdfs', $fix) || $hasError;
        $hasError = $this->checkDirectory('local',  'contract-imports', $fix) || $hasError;
        $hasError = $this->smokeTest() || $hasError;

        $this->newLine();
        if ($hasError) {
            $this->error('Diagnóstico finalizado COM PROBLEMAS.');
            if (!$fix) {
                $this->warn('Rode novamente com --fix para tentar reparo automático: php artisan storage:check --fix');
            }
            return self::FAILURE;
        }

        $this->info('Tudo certo. Storage operacional para uploads.');
        return self::SUCCESS;
    }

    /**
     * Verifica/repara o symlink `public/storage -> storage/app/public`.
     * Sem ele, qualquer arquivo gravado no disco `public` fica inacessível
     * via HTTP em produção (URLs tipo /storage/users/photos/xxx.png).
     */
    private function checkSymlink(bool $fix): bool
    {
        $linkPath = public_path('storage');

        if (file_exists($linkPath)) {
            $this->line(" [OK]  public/storage existe (" . (is_link($linkPath) ? 'symlink' : 'diretório/junction') . ')');
            return false;
        }

        $this->error(" [ERR] public/storage NÃO existe — `php artisan storage:link` precisa rodar.");

        if (!$fix) {
            return true;
        }

        try {
            Artisan::call('storage:link');
            $this->info('       → storage:link executado. Verificando…');
            return !file_exists($linkPath);
        } catch (Throwable $e) {
            $this->error('       Falhou: ' . $e->getMessage());
            return true;
        }
    }

    /**
     * Garante que um diretório existe dentro de um disco Laravel.
     * Tenta criar via Flysystem se `--fix` foi passado.
     */
    private function checkDirectory(string $diskName, string $relativeDir, bool $fix): bool
    {
        try {
            $disk = Storage::disk($diskName);
        } catch (Throwable $e) {
            $this->error(" [ERR] disco `{$diskName}` não pôde ser obtido: " . $e->getMessage());
            return true;
        }

        $root = config("filesystems.disks.{$diskName}.root");

        if ($disk->exists($relativeDir)) {
            $this->line(" [OK]  {$diskName}://{$relativeDir} existe ({$root}/{$relativeDir})");
            return false;
        }

        $this->error(" [ERR] {$diskName}://{$relativeDir} NÃO existe ({$root}/{$relativeDir})");

        if (!$fix) {
            return true;
        }

        try {
            $disk->makeDirectory($relativeDir);
            $stillMissing = !$disk->exists($relativeDir);
            if ($stillMissing) {
                $this->error('       → makeDirectory() não persistiu o diretório (perms?).');
            } else {
                $this->info('       → criado com sucesso.');
            }
            return $stillMissing;
        } catch (Throwable $e) {
            $this->error('       Falhou: ' . $e->getMessage());
            return true;
        }
    }

    /**
     * Smoke test: grava um arquivinho temporário no disco `public`, lê de
     * volta e remove. Se algo aqui falhar, o problema é de permissão de
     * escrita no usuário do PHP.
     */
    private function smokeTest(): bool
    {
        $disk = Storage::disk('public');
        $relPath = 'users/photos/.storage-check-' . uniqid() . '.tmp';

        try {
            $disk->put($relPath, 'storage-check');
            if (!$disk->exists($relPath)) {
                $this->error(' [ERR] smoke test: put() não persistiu o arquivo (perms de escrita?).');
                return true;
            }

            $contents = $disk->get($relPath);
            if ($contents !== 'storage-check') {
                $this->error(' [ERR] smoke test: leitura retornou conteúdo inesperado.');
                $disk->delete($relPath);
                return true;
            }

            $disk->delete($relPath);
            $this->line(' [OK]  smoke test (write + read + delete em users/photos)');
            return false;
        } catch (Throwable $e) {
            $this->error(' [ERR] smoke test falhou: ' . $e->getMessage());
            return true;
        }
    }
}
