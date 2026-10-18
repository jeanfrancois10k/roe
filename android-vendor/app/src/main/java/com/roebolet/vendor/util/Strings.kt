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

            // Pre-validation Preview
            "pre_validation_preview" -> if (ht) "APÈSI AVAN ENPRESYON" else "APERÇU AVANT IMPRESSION"
            "confirm_and_print" -> if (ht) "KONFIME & ENPRIME" else "CONFIRMER & IMPRIMER"
            "modify_ticket" -> if (ht) "MODIFYE" else "MODIFIER"
            "verify_numbers_amounts" -> if (ht) "Verifye nimewo ak montan yo avan ou valide" else "Vérifiez les numéros et montants avant de confirmer"

            // Reports
            "sales_reports" -> if (ht) "RAPÒ VANT" else "RAPPORTS DES VENTES"
            "today" -> if (ht) "Jòdi a" else "Aujourd'hui"
            "this_week" -> if (ht) "Semèn sa a" else "Cette Semaine"
            "this_month" -> if (ht) "Mwa sa a" else "Ce Mois"
            "sales_by_draw" -> if (ht) "VANT PA TIRAJ" else "VENTES PAR TIRAGE"
            "global_summary" -> if (ht) "REZIME JENERAL" else "RÉSUMÉ GLOBAL"
            "tickets_sold" -> if (ht) "Fich ki vann" else "Tickets vendus"
            "total_sold_amount" -> if (ht) "Total Lajan Vann" else "Montant total vendu"
            "winning_tickets" -> if (ht) "Fich ki genyen" else "Tickets gagnants"
            "prizes_paid" -> if (ht) "Lòt peye" else "Gains payés"
            "net_sales" -> if (ht) "Vant Nèt" else "Vente Nette"

            // Search by Ticket Code & Reprint / Modify
            "search_by_code" -> if (ht) "Chèche pa kòd fich" else "Rechercher par code ticket"
            "ticket_code_placeholder" -> if (ht) "Kòd fich la (egz: TCK-12345)..." else "Code du ticket (ex: TCK-12345)..."
            "search_ticket_code_title" -> if (ht) "CHÈCHE YON FICH" else "RECHERCHER UN TICKET"
            "search_ticket_code_sub" -> if (ht) "Antre kòd fich la pou w ka modifye li oswa re-enprime li" else "Entrez le code pour modifier ou réimprimer"
            "reprint_ticket" -> if (ht) "RE-ENPRIME" else "RÉIMPRIMER"
            "modify_or_replay" -> if (ht) "MODIFYE" else "MODIFIER"
            "ticket_not_found" -> if (ht) "Fich sa a pa jwenn sou sèvè a" else "Ticket introuvable sur le serveur"
            "search_server" -> if (ht) "Chèche sou sèvè" else "Rechercher sur le serveur"
            "reprint_success" -> if (ht) "Fich la voye nan enprimant lan avèk siksè !" else "Ticket réimprimé avec succès !"
            "ticket_loaded_for_modification" -> if (ht) "Fich la chaje ! Ou ka modifye nimewo yo kounye a." else "Ticket chargé ! Vous pouvez modifier les numéros."

            else -> key
        }
    }
}
