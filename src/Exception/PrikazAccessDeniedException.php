<?php

namespace App\Exception;

/**
 * Uživatel nemá oprávnění k příkazu (není mezi INT_ADR v hlavičce příkazu).
 *
 * Dědí z \Exception, takže stávající `catch (Exception)` bloky fungují beze změny;
 * kdo potřebuje odlišit "nepřiděleno" od výpadku INSYZ, chytá tuto třídu.
 */
class PrikazAccessDeniedException extends \Exception
{
    public function __construct()
    {
        parent::__construct('Tento příkaz vám nebyl přidělen a nemáte oprávnění k jeho nahlížení.');
    }
}
