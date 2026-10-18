package com.roebolet.vendor.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf

enum class AppLanguage(val code: String, val label: String) {
    FRENCH("fr", "Français"),
    CREOLE("ht", "Kreyòl")
}

val LocalAppLanguage = compositionLocalOf { AppLanguage.CREOLE }

object Strings {
    fun t(key: String, lang: AppLanguage = AppLanguage.CREOLE): String {
        val ht = lang == AppLanguage.CREOLE
        return when (key) {
            // General & Common
            "app_title" -> if (ht) "ROE BÒLÈT" else "ROE BOLET"
            "official_terminal" -> if (ht) "TÈMINAL VANT OFISYÈL" else "TERMINAL DE VENTE OFFICIEL"
            "vendor_id" -> if (ht) "KÒD VANDÈ" else "ID VENDEUR"
            "enter_pin" -> if (ht) "ANTRE KÒD PIN" else "ENTREZ LE CODE PIN"
            "login" -> if (ht) "KONEKTE" else "CONNEXION"
            "logout" -> if (ht) "Dekonekte" else "Déconnexion"
            "lock" -> if (ht) "Fèmen" else "Verrouiller"
            "back" -> if (ht) "Tounen" else "Retour"
            "save" -> if (ht) "Anrejistre" else "Enregistrer"
            "cancel" -> if (ht) "Anile" else "Annuler"
            "confirm" -> if (ht) "Konfime" else "Confirmer"
            "close" -> if (ht) "Fèmen" else "Fermer"
            "loading" -> if (ht) "Chajman ap fèt..." else "Chargement en cours..."
            "online" -> if (ht) "An liy" else "En ligne"
            "offline" -> if (ht) "Òf liy" else "Hors ligne"
            "pending" -> if (ht) "an pant" else "en attente"

            // Dashboard
            "new_sale" -> if (ht) "NOUVO VANT" else "NOUVELLE VENTE"
            "issue_ticket" -> if (ht) "Fè yon fich bòlèt" else "Émettre un ticket de bolet"
            "verify_ticket" -> if (ht) "VERIFYE FICH" else "VÉRIFIER TICKET"
            "tickets" -> if (ht) "FICH YO" else "TICKETS"
            "results" -> if (ht) "REZILTA" else "RÉSULTATS"
            "balance" -> if (ht) "KONT / SÒLD" else "SOLDE"
            "history" -> if (ht) "ISTORIK" else "HISTORIQUE"
            "sync" -> if (ht) "SENKWO" else "SYNCHRO"
            "settings" -> if (ht) "PARAMÈT" else "PARAMÈTRES"
            "total_sales" -> if (ht) "TOTAL VANT" else "VENTES DU JOUR"
            "commission" -> if (ht) "KOMISYON" else "COMMISSION"

            // Sell Ticket
            "choose_draw" -> if (ht) "Chwazi Tiraj" else "Choisir un tirage"
            "number" -> if (ht) "Nimewo" else "Numéro"
            "amount" -> if (ht) "Montan" else "Montant"
            "total" -> if (ht) "Total" else "Total"
            "print_ticket" -> if (ht) "ENPRIME FICH" else "IMPRIMER LE TICKET"
            "clear_all" -> if (ht) "Efase tout" else "Tout effacer"
            "ticket_success" -> if (ht) "Fich la soti avèk siksè !" else "Ticket émis avec succès !"
            "ticket_number" -> if (ht) "Nimewo Fich" else "Numéro Ticket"
            "draw" -> if (ht) "Tiraj" else "Tirage"

            // Settings
            "server_url" -> if (ht) "Adrès Sèvè Cloud" else "URL du Serveur Cloud"
            "device_uuid" -> if (ht) "Nimewo Aparèy (UUID)" else "Identifiant UUID Matériel"
            "language" -> if (ht) "Lang Aplikasyon" else "Langue de l'application"
            "test_printer" -> if (ht) "TESTE ENPRIMANT" else "TESTER L'IMPRIMANTE THERMIQUE"
            "app_version" -> if (ht) "Vèsyon Lojisyèl" else "Version Logiciel"

            // Tickets History, Preview, Replay, Cancel
            "tickets_history" -> if (ht) "ISTORIK FICH YO" else "HISTORIQUE DES TICKETS"
            "search_ticket" -> if (ht) "Chèche nimewo fich..." else "Rechercher un ticket..."
            "preview_ticket" -> if (ht) "Wè Fich" else "Aperçu Fiche"
            "replay_ticket" -> if (ht) "Rejoue / Modifye" else "Rejouer / Modifier"
            "cancel_sale" -> if (ht) "Annile Fich" else "Annuler la Vente"
            "confirm_cancel_title" -> if (ht) "Konfime Anilasyon" else "Confirmer l'annulation"
            "confirm_cancel_msg" -> if (ht) "Èske ou vle annile fich sa a vre ? Lajan an ap remèt nan balans ou." else "Êtes-vous sûr de vouloir annuler ce ticket ? Le montant sera recrédité."
            "cancel_success" -> if (ht) "Fich la annile avèk siksè !" else "Ticket annulé avec succès !"
            "ticket_preview_title" -> if (ht) "APÈSI FICH VANT" else "APERÇU DE LA FICHE DE VENTE"
            "multi_draws_select" -> if (ht) "Chwazi Tiraj (Ou ka chwazi plizyè)" else "Choisir les tirages (Multi-sélection)"
            "selected_draws_count" -> if (ht) "tiraj chwazi" else "tirage(s) sélectionné(s)"

            else -> key
        }
    }
}
