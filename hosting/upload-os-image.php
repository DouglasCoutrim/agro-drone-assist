<?php
/**
 * upload-os-image.php
 * Recebe a imagem da Edge Function do Supabase e grava em disco na hospedagem.
 *
 * COMO USAR:
 *  1. Envie este arquivo para a RAIZ do site: public_html/upload-os-image.php
 *  2. A URL final fica: https://livreos.net/upload-os-image.php
 *  3. As imagens são gravadas em: public_html/uploads/{empresa}/{os}/{arquivo}.jpg
 *
 * A senha (SECRET) abaixo precisa ser IGUAL ao valor de http_upload_secret
 * na tabela public.ftp_config do Supabase.
 */

$SECRET      = 'lvos_9f3c7a1e5b8d4260a1c2e7d4';
$BASE_DIR    = __DIR__ . '/uploads';          // pasta física onde os arquivos ficam
$PUBLIC_BASE = 'https://livreos.net/uploads';  // URL pública correspondente
$MAX_BYTES   = 5 * 1024 * 1024;                // 5 MB

header('Content-Type: application/json; charset=utf-8');

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Método não permitido');
}

$provided = $_SERVER['HTTP_X_UPLOAD_SECRET'] ?? '';
if (!hash_equals($SECRET, $provided)) {
    fail(401, 'Segredo inválido');
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'Arquivo não recebido');
}

$tmp  = $_FILES['file']['tmp_name'];
$size = (int) ($_FILES['file']['size'] ?? 0);
if ($size <= 0 || $size > $MAX_BYTES) {
    fail(400, 'Tamanho inválido (máximo 5 MB)');
}

// Confirma que é realmente uma imagem
if (@getimagesize($tmp) === false) {
    fail(400, 'O arquivo não é uma imagem válida');
}

// Caminho relativo: {empresa}/{os}/{arquivo}.jpg
$rel = $_POST['relative_path'] ?? '';
$rel = str_replace('\\', '/', $rel);
$rel = preg_replace('#/+#', '/', $rel);
$rel = ltrim($rel, '/');

if ($rel === '' || strpos($rel, '..') !== false || !preg_match('#^[A-Za-z0-9._/-]+$#', $rel)) {
    fail(400, 'Caminho inválido');
}

$ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
    fail(400, 'Extensão não permitida');
}

$destPath = $BASE_DIR . '/' . $rel;
$destDir  = dirname($destPath);

if (!is_dir($destDir) && !@mkdir($destDir, 0755, true)) {
    fail(500, 'Falha ao criar diretório de destino');
}

if (!@move_uploaded_file($tmp, $destPath)) {
    fail(500, 'Falha ao salvar o arquivo');
}

@chmod($destPath, 0644);

echo json_encode(['url' => rtrim($PUBLIC_BASE, '/') . '/' . $rel]);