<?php

namespace App\Exception;

/**
 * Neúspěšné ověření požadavku desktopového klienta INSYZ.
 *
 * Ven jde vždy jedna generická hláška; konkrétní důvod ($reason) slouží
 * výhradně pro server-side log, nikdy se nevrací klientovi.
 */
class InsyzClientAuthException extends \RuntimeException
{
    public const REASON_UNKNOWN_KEY = 'unknown_key';
    public const REASON_UNKNOWN_USER = 'unknown_user';
    public const REASON_BAD_PASSWORD = 'bad_password';
    public const REASON_ACCOUNT_NOT_VALID = 'account_not_valid';
    public const REASON_THROTTLED = 'throttled';
    public const REASON_INVALID_REQUEST = 'invalid_request';

    public function __construct(private string $reason)
    {
        parent::__construct($reason);
    }

    public function getReason(): string
    {
        return $this->reason;
    }
}
