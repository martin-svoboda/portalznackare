<?php

namespace App\Tests\Service;

use App\Service\InsyzLegacyPasswordCipher;
use PHPUnit\Framework\TestCase;

/**
 * Vektory níže byly vygenerovány referenční implementací
 * (openssl des-cbc s legacy providerem, klíč/IV schématu INSYZ, text v UTF-16LE).
 */
class InsyzLegacyPasswordCipherTest extends TestCase
{
    private InsyzLegacyPasswordCipher $cipher;

    protected function setUp(): void
    {
        $this->cipher = new InsyzLegacyPasswordCipher();
    }

    public function testDecryptsAsciiPassword(): void
    {
        $this->assertSame('Heslo123', $this->cipher->decrypt('LC25nIxFrhEw6p+ORkSd+PD9SjKrD6vb'));
    }

    public function testDecryptsShortPasswordWithFullPaddingBlock(): void
    {
        $this->assertSame('test', $this->cipher->decrypt('7k3kjwZo+sq5fV4GNxZz5Q=='));
    }

    public function testDecryptsCzechDiacritics(): void
    {
        $this->assertSame('ěščřžýáíé', $this->cipher->decrypt('wYcmaXE8WZgDTzVdsvkFUxR3rzB/qe0M'));
    }

    public function testIgnoresSurroundingWhitespace(): void
    {
        $this->assertSame('Heslo123', $this->cipher->decrypt("  LC25nIxFrhEw6p+ORkSd+PD9SjKrD6vb\n"));
    }

    /**
     * @dataProvider invalidInputs
     */
    public function testInvalidInputReturnsNull(string $input, string $description): void
    {
        $this->assertNull($this->cipher->decrypt($input), $description);
    }

    public static function invalidInputs(): array
    {
        return [
            ['', 'prázdný vstup'],
            ['nonsense!!!', 'nevalidní base64'],
            [base64_encode('1234567'), 'délka není násobek 8'],
            [base64_encode(str_repeat("\x00", 8)), 'nesmyslný blok = poškozený padding'],
            ['LC25nIxFrhEw6p+ORkSd+PD9SjKrD6va', 'změněný poslední znak šifrového textu'],
        ];
    }

    public function testDecryptedPasswordIsNotTrimmedOrAltered(): void
    {
        // Heslo s mezerou uvnitř i na konci musí projít beze změny
        $this->assertSame('a b ', $this->cipher->decrypt('yqNcJt46dNyp8527iPcs6A=='));
    }
}
