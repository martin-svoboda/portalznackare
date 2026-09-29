<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Účet deaktivovaný v portálu (app:user:manage deactivate) se nepřihlásí –
 * ani heslem, ani přes „zapamatovat si mě“. Přihlašovací údaje ověřuje INSYZ,
 * deaktivace je čistě portálová.
 */
class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
        if ($user instanceof User && !$user->isActive()) {
            throw new CustomUserMessageAccountStatusException('Účet je v portálu deaktivován. Kontaktujte administrátora.');
        }
    }

    public function checkPostAuth(UserInterface $user): void
    {
    }
}
