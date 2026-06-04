<?php
declare(strict_types=1);

namespace DoggyLog;

use InvalidArgumentException;

final class Storage
{
    private const COLLECTIONS = [
        'dogs' => 'dogs',
        'locations' => 'locations',
        'contexts' => 'contexts',
        'vitals' => 'vitals',
    ];

    private const FIELD_SCHEMAS = [
        'dogs' => [
            'name' => ['type' => 'string', 'default' => 'Mein Hund'],
            'notes' => ['type' => 'string', 'default' => ''],
            'visible' => ['type' => 'boolean', 'default' => true],
        ],
        'locations' => [
            'name' => ['type' => 'string', 'default' => ''],
            'visible' => ['type' => 'boolean', 'default' => true],
        ],
        'contexts' => [
            'name' => ['type' => 'string', 'default' => ''],
            'visible' => ['type' => 'boolean', 'default' => true],
        ],
        'vitals' => [
            'measured_at' => ['type' => 'datetime-local', 'default' => ''],
            'dog_id' => ['type' => 'string', 'default' => ''],
            'mode' => ['type' => 'string', 'default' => 'resting'],
            'breaths_per_minute' => ['type' => 'number', 'default' => null],
            'pulse_per_minute' => ['type' => 'number', 'default' => null],
            'location_id' => ['type' => 'string', 'default' => ''],
            'context_ids' => ['type' => 'array', 'default' => []],
            'notes' => ['type' => 'string', 'default' => ''],
        ],
    ];

    private const META_FIELDS = [
        '_id',
        '_revision',
        '_created',
        '_modified',
        '_modifiedBy',
        '_deleted',
    ];

    private string $basePath;

    public function __construct(string $basePath)
    {
        $this->basePath = rtrim($basePath, '/\\');
    }

    public function ensureStructure(): void
    {
        foreach ([$this->dataPath(), $this->varPath(), $this->varPath() . '/auth'] as $directory) {
            if (!is_dir($directory)) {
                mkdir($directory, 0775, true);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function status(bool $includeCounts = true, ?string $username = null): array
    {
        return [
            'writable' => is_writable($this->dataPath()),
            'runtime_writable' => is_writable($this->varPath()),
            'collections' => $includeCounts ? $this->counts($username) : [],
            'schemas' => $username !== null ? $this->schemas() : [],
        ];
    }

    /**
     * @return array<string, int>
     */
    public function counts(?string $username = null): array
    {
        $counts = [];
        foreach (array_keys(self::COLLECTIONS) as $type) {
            $counts[$type] = count(array_filter($this->objectFiles($type, $username), function (string $file): bool {
                return !$this->isDeletedObject($this->readJson($file));
            }));
        }

        return $counts;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listObjects(string $type, string $username): array
    {
        $this->assertCollection($type);
        $this->assertUsername($username);

        $objects = [];
        foreach ($this->objectFiles($type, $username) as $file) {
            $object = $this->readJson($file);
            if ($this->isDeletedObject($object)) {
                continue;
            }

            if (in_array($type, ['dogs', 'locations', 'contexts'], true)) {
                $object['visible'] = (bool) ($object['visible'] ?? true);
            }
            $objects[] = $object;
        }

        usort($objects, static function (array $left, array $right): int {
            return strcmp((string) ($right['measured_at'] ?? $right['_created'] ?? ''), (string) ($left['measured_at'] ?? $left['_created'] ?? ''));
        });

        return $objects;
    }

    /**
     * @return array<string, mixed>
     */
    public function readObject(string $type, string $id, string $username): array
    {
        $this->assertCollection($type);
        $this->assertId($id);
        $this->assertUsername($username);

        $path = $this->objectPath($type, $id, $username);
        if (!is_file($path)) {
            throw new InvalidArgumentException('Object not found.');
        }

        $object = $this->readJson($path);
        if ($this->isDeletedObject($object)) {
            throw new InvalidArgumentException('Object not found.');
        }

        return $object;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function recentChanges(string $username): array
    {
        $this->assertUsername($username);

        $changes = [];
        foreach (array_keys(self::COLLECTIONS) as $type) {
            foreach ($this->objectFiles($type, $username) as $file) {
                $object = $this->readJson($file);
                $changes[] = [
                    'type' => $type,
                    'id' => (string) ($object['_id'] ?? ''),
                    'revision' => (int) ($object['_revision'] ?? 0),
                    'modified_at' => (string) ($object['_modified'] ?? ''),
                    'modified_by' => (string) ($object['_modifiedBy'] ?? ''),
                    'deleted' => (bool) ($object['_deleted'] ?? false),
                    'summary' => $this->summary($object),
                ];
            }
        }

        usort($changes, static fn (array $left, array $right): int => strcmp((string) $right['modified_at'], (string) $left['modified_at']));

        return array_slice($changes, 0, 100);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function schemas(): array
    {
        $schemas = [];
        foreach (self::FIELD_SCHEMAS as $type => $fields) {
            $schemas[$type] = ['fields' => $fields];
        }

        return $schemas;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createObject(string $type, array $payload, string $username, string $source = ''): array
    {
        $this->assertCollection($type);
        $this->assertUsername($username);

        $id = $this->uuid();
        $now = $this->now();
        $object = array_merge($this->defaults($type), $this->normalizePayload($type, $payload), [
            '_id' => $id,
            '_revision' => 1,
            '_created' => $now,
            '_modified' => $now,
            '_modifiedBy' => $username,
            '_deleted' => false,
        ]);
        if ($type === 'dogs') {
            $object['name'] = trim((string) ($object['name'] ?? '')) !== '' ? trim((string) $object['name']) : 'Mein Hund';
        }
        if ($type === 'locations' || $type === 'contexts') {
            $object['name'] = trim((string) ($object['name'] ?? ''));
            if ($object['name'] === '') {
                throw new InvalidArgumentException('Name is required.');
            }
        }
        $this->writeJson($this->objectPath($type, $id, $username), $object);

        return $object;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updateObject(string $type, string $id, int $baseRevision, array $payload, string $username, string $source = '', bool $initialWrite = false): array
    {
        $this->assertCollection($type);
        $this->assertId($id);

        $this->assertUsername($username);
        $path = $this->objectPath($type, $id, $username);
        if (!is_file($path)) {
            throw new InvalidArgumentException('Object not found.');
        }

        $current = $this->readJson($path);
        if ($this->isDeletedObject($current)) {
            throw new InvalidArgumentException('Object not found.');
        }

        if ((int) ($current['_revision'] ?? 0) !== $baseRevision) {
            throw new StorageConflictException('Object was changed by someone else.', $current);
        }

        $updated = array_merge($current, $this->normalizePayload($type, $payload));
        if ($type === 'vitals' && array_key_exists('notes', $payload)) {
            unset($updated['comment']);
        }
        if ($type === 'vitals') {
            unset($updated['measurement_type'], $updated['duration_seconds'], $updated['breath_duration_seconds'], $updated['pulse_duration_seconds']);
        }
        $updated['_revision'] = (int) ($current['_revision'] ?? 0) + 1;
        $updated['_modified'] = $this->now();
        $updated['_modifiedBy'] = $username;
        $updated['_deleted'] = false;

        $this->archiveRevision($type, $id, (int) ($current['_revision'] ?? 0), $current, $username);
        $this->writeJson($path, $updated);

        return $updated;
    }

    /**
     * @return array<string, mixed>
     */
    public function deleteObject(string $type, string $id, int $baseRevision, string $username, string $source = ''): array
    {
        $this->assertCollection($type);
        $this->assertId($id);

        $this->assertUsername($username);
        $path = $this->objectPath($type, $id, $username);
        if (!is_file($path)) {
            throw new InvalidArgumentException('Object not found.');
        }

        $current = $this->readJson($path);
        if ((int) ($current['_revision'] ?? 0) !== $baseRevision) {
            throw new StorageConflictException('Object was changed by someone else.', $current);
        }

        $deleted = $current;
        $deleted['_revision'] = (int) ($current['_revision'] ?? 0) + 1;
        $deleted['_modified'] = $this->now();
        $deleted['_modifiedBy'] = $username;
        $deleted['_deleted'] = true;

        $this->archiveRevision($type, $id, (int) ($current['_revision'] ?? 0), $current, $username);
        $this->writeJson($path, $deleted);

        return $deleted;
    }

    private function dataPath(): string
    {
        return $this->basePath . '/data';
    }

    private function userPath(string $username): string
    {
        $this->assertUsername($username);
        return $this->dataPath() . '/' . $username;
    }

    private function varPath(): string
    {
        return $this->basePath . '/var';
    }

    private function collectionPath(string $type, string $username): string
    {
        $this->assertCollection($type);
        $this->assertUsername($username);
        return $this->userPath($username) . '/' . self::COLLECTIONS[$type];
    }

    private function objectPath(string $type, string $id, string $username): string
    {
        return $this->collectionPath($type, $username) . '/' . $id . '.json';
    }

    /**
     * @return array<int, string>
     */
    private function objectFiles(string $type, ?string $username): array
    {
        if ($username === null || $username === '') {
            $files = glob($this->dataPath() . '/*/' . self::COLLECTIONS[$type] . '/*.json');
        } else {
            $files = glob($this->collectionPath($type, $username) . '/*.json');
        }
        return is_array($files) ? array_values(array_filter($files, static fn (string $file): bool => !str_contains(basename($file), '_'))) : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(string $type): array
    {
        $defaults = [];
        foreach (self::FIELD_SCHEMAS[$type] ?? [] as $field => $definition) {
            $defaults[$field] = $definition['default'] ?? null;
        }

        return $defaults;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizePayload(string $type, array $payload): array
    {
        $normalized = [];
        foreach ($payload as $field => $value) {
            if (in_array($field, self::META_FIELDS, true) || !array_key_exists($field, self::FIELD_SCHEMAS[$type])) {
                continue;
            }

            if (in_array($field, ['breaths_per_minute', 'pulse_per_minute'], true)) {
                if ($value === '' || $value === null) {
                    $normalized[$field] = null;
                    continue;
                }

                if (!is_numeric($value)) {
                    throw new InvalidArgumentException('Vital value must be numeric.');
                }

                $number = round((float) $value, 1);
                if ($number < 0 || $number > 400) {
                    throw new InvalidArgumentException('Vital value is out of range.');
                }

                $normalized[$field] = $number;
                continue;
            }

            if ($field === 'dog_id') {
                $dogId = trim((string) $value);
                if ($dogId !== '') {
                    $this->assertId($dogId);
                }
                $normalized[$field] = $dogId;
                continue;
            }

            if ($field === 'mode') {
                $mode = trim((string) $value);
                $allowed = ['resting', 'active', 'panting', 'sleeping'];
                if (!in_array($mode, $allowed, true)) {
                    throw new InvalidArgumentException('Measurement mode is invalid.');
                }
                $normalized[$field] = $mode;
                continue;
            }

            if ($field === 'location') {
                continue;
            }

            if ($field === 'location_id') {
                $locationId = trim((string) $value);
                if ($locationId !== '') {
                    $this->assertId($locationId);
                }
                $normalized[$field] = $locationId;
                continue;
            }

            if ($field === 'context_ids') {
                $values = is_array($value) ? $value : explode(',', (string) $value);
                $ids = [];
                foreach ($values as $item) {
                    $contextId = trim((string) $item);
                    if ($contextId === '') {
                        continue;
                    }
                    $this->assertId($contextId);
                    $ids[] = strtolower($contextId);
                }
                $normalized[$field] = array_slice(array_values(array_unique($ids)), 0, 30);
                continue;
            }

            if (in_array($type, ['dogs', 'locations', 'contexts'], true) && $field === 'name') {
                $name = trim((string) $value);
                $normalized[$field] = $name !== '' ? substr($name, 0, 80) : ($type === 'dogs' ? 'Mein Hund' : '');
                continue;
            }

            if (in_array($type, ['dogs', 'locations', 'contexts'], true) && $field === 'visible') {
                $normalized[$field] = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
                continue;
            }

            $normalized[$field] = trim((string) $value);
        }

        if (array_key_exists('measured_at', $normalized) && $normalized['measured_at'] !== '') {
            $timestamp = strtotime((string) $normalized['measured_at']);
            if ($timestamp === false) {
                throw new InvalidArgumentException('Measurement time is invalid.');
            }
            $normalized['measured_at'] = gmdate('c', $timestamp);
        }

        return $normalized;
    }

    private function assertCollection(string $type): void
    {
        if (!array_key_exists($type, self::COLLECTIONS)) {
            throw new InvalidArgumentException('Unknown collection.');
        }
    }

    private function assertId(string $id): void
    {
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id)) {
            throw new InvalidArgumentException('Invalid object ID.');
        }
    }

    private function assertUsername(string $username): void
    {
        if ($username === '' || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $username) !== 1) {
            throw new InvalidArgumentException('Invalid user ID.');
        }
    }

    /**
     * @param array<string, mixed> $object
     */
    private function isDeletedObject(array $object): bool
    {
        return (bool) ($object['_deleted'] ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    private function readJson(string $path): array
    {
        $raw = is_file($path) ? file_get_contents($path) : '{}';
        if ($raw === false) {
            throw new InvalidArgumentException('Could not read object.');
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $data
     */
    private function writeJson(string $path, array $data): void
    {
        $directory = dirname($path);
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $tmp = $path . '.tmp';
        $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        if (file_put_contents($tmp, $encoded, LOCK_EX) === false || !rename($tmp, $path)) {
            @unlink($tmp);
            throw new InvalidArgumentException('Could not write object.');
        }
    }

    /**
     * @param array<string, mixed> $object
     */
    private function archiveRevision(string $type, string $id, int $revision, array $object, string $username): void
    {
        if ($revision <= 0) {
            return;
        }

        $this->writeJson($this->collectionPath($type, $username) . '/' . $id . '_' . $revision . '.json', $object);
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
    }

    private function now(): string
    {
        return gmdate('c');
    }

    /**
     * @param array<string, mixed> $object
     */
    private function summary(array $object): string
    {
        $parts = [];
        foreach (['breaths_per_minute' => 'AF', 'pulse_per_minute' => 'Puls'] as $field => $label) {
            if (($object[$field] ?? null) !== null && $object[$field] !== '') {
                $parts[] = $label . ' ' . $object[$field];
            }
        }

        return $parts === [] ? 'Vitalzeichen' : implode(', ', $parts);
    }
}
