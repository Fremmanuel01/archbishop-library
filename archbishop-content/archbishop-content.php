<?php
/**
 * Plugin Name: Archbishop Content
 * Plugin URI:  https://archbishopokeke.com
 * Description: Displays pastoral letters, homilies, and writings from the Archbishop Library CMS via shortcodes.
 * Version:     2.0.0
 * Author:      Archbishop Library CMS
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ABCONTENT_VERSION', '2.0.0' );
define( 'ABCONTENT_CACHE_TTL', 300 );

/* ══════════════════════════════════════════════
   Settings page
   ══════════════════════════════════════════════ */

add_action( 'admin_menu', 'abcontent_admin_menu' );

function abcontent_admin_menu() {
    add_options_page(
        'Archbishop Content Settings',
        'Archbishop Content',
        'manage_options',
        'archbishop-content',
        'abcontent_settings_page'
    );
}

add_action( 'admin_init', 'abcontent_register_settings' );

function abcontent_register_settings() {
    register_setting( 'abcontent_settings', 'abcontent_api_url', array(
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default'           => '',
    ) );
}

function abcontent_settings_page() {
    ?>
    <div class="wrap">
        <h1>Archbishop Content Settings</h1>
        <form method="post" action="options.php">
            <?php settings_fields( 'abcontent_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="abcontent_api_url">API Base URL</label></th>
                    <td>
                        <input type="url" id="abcontent_api_url" name="abcontent_api_url"
                               value="<?php echo esc_attr( get_option( 'abcontent_api_url', '' ) ); ?>"
                               class="regular-text" placeholder="https://api.archbishopokeke.com/api">
                        <p class="description">
                            Enter the full API base URL from your Archbishop Library CMS dashboard
                            (e.g. <code>https://api.archbishopokeke.com/api</code>).
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button( 'Save Settings' ); ?>
        </form>
        <hr>
        <h2>Shortcodes</h2>
        <table class="widefat" style="max-width:600px;">
            <thead><tr><th>Shortcode</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td><code>[archbishop_pastoral_letters]</code></td><td>Displays all pastoral letters</td></tr>
                <tr><td><code>[archbishop_homilies]</code></td><td>Displays all homilies</td></tr>
                <tr><td><code>[archbishop_writings]</code></td><td>Displays all writings</td></tr>
            </tbody>
        </table>
    </div>
    <?php
}

/* ══════════════════════════════════════════════
   API helper
   ══════════════════════════════════════════════ */

function abcontent_fetch( $endpoint ) {
    $base = rtrim( get_option( 'abcontent_api_url', '' ), '/' );
    if ( empty( $base ) ) {
        return new WP_Error( 'no_api_url', 'Archbishop Content: API URL not configured.' );
    }

    $cache_key = 'abcontent_' . md5( $endpoint );
    $cached    = get_transient( $cache_key );
    if ( false !== $cached ) {
        return $cached;
    }

    $response = wp_remote_get( $base . $endpoint, array(
        'timeout' => 15,
        'headers' => array( 'Accept' => 'application/json' ),
    ) );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) {
        return new WP_Error( 'api_error', 'Archbishop Content: API returned status ' . $code );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( empty( $body ) || empty( $body['success'] ) ) {
        return new WP_Error( 'api_invalid', 'Archbishop Content: Invalid API response.' );
    }

    set_transient( $cache_key, $body['data'], ABCONTENT_CACHE_TTL );
    return $body['data'];
}

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function abcontent_error_notice( $error ) {
    $message = is_wp_error( $error ) ? $error->get_error_message() : 'Unable to load content.';
    return '<div style="border:1px solid #e0c29a;background:#fff8ed;color:#8b6914;padding:16px 20px;
            border-radius:8px;font-family:Georgia,serif;font-size:15px;text-align:center;margin:20px 0;">
            <strong>Notice:</strong> ' . esc_html( $message ) .
           ' <br><small>Please check back shortly.</small></div>';
}

function abcontent_download_url( $url ) {
    if ( empty( $url ) ) return '';
    if ( strpos( $url, 'cloudinary.com' ) !== false || strpos( $url, 'res.cloudinary' ) !== false ) {
        return str_replace( '/upload/', '/upload/fl_attachment/', $url );
    }
    return $url;
}

function abcontent_base_url() {
    $api_url = rtrim( get_option( 'abcontent_api_url', '' ), '/' );
    /* Strip /api from end to get the base domain */
    return preg_replace( '#/api$#', '', $api_url );
}

function abcontent_back_button( $settings ) {
    if ( empty( $settings['back_button_label'] ) || empty( $settings['back_button_url'] ) ) {
        return '';
    }

    $vis  = isset( $settings['back_button_visibility'] ) ? $settings['back_button_visibility'] : 'both';
    $host = isset( $_SERVER['HTTP_HOST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';

    if ( $vis === 'admissions' && strpos( $host, 'admissions' ) === false ) return '';
    if ( $vis === 'archdiocese' && strpos( $host, 'admissions' ) !== false ) return '';

    $color = ! empty( $settings['back_button_color'] ) ? $settings['back_button_color'] : '#c9a84c';
    $font  = ! empty( $settings['body_font'] ) ? $settings['body_font'] : 'Lora';

    return '<div style="margin:12px 0;">
        <a href="' . esc_url( $settings['back_button_url'] ) . '"
           style="display:inline-block;padding:calc(.667em + 2px) calc(1.333em + 2px);background:' . esc_attr( $color ) . ';
                  color:#fff;text-decoration:none;border-radius:9999px;font-size:13px;
                  font-family:\'Cinzel\',serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;
                  transition:all 0.3s ease;"
           onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(201,168,76,0.4)\'"
           onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'">
           ' . esc_html( $settings['back_button_label'] ) . '
        </a>
    </div>';
}

function abcontent_tone_color( $tone ) {
    $colors = array(
        'Reflective'    => '#6c5ce7',
        'Instructional' => '#0984e3',
        'Celebratory'   => '#00b894',
        'Pastoral'      => '#1a3c6e',
        'Urgent'        => '#d63031',
    );
    return isset( $colors[ $tone ] ) ? $colors[ $tone ] : '#1a3c6e';
}

/* ══════════════════════════════════════════════
   Scoped style block
   ══════════════════════════════════════════════ */

function abcontent_style_block( $cls, $s ) {
    $primary = ! empty( $s['primary_color'] )    ? $s['primary_color']    : '#1a3c6e';
    $bg      = ! empty( $s['background_color'] ) ? $s['background_color'] : '#ffffff';
    $text    = ! empty( $s['text_color'] )       ? $s['text_color']       : '#333333';
    $accent  = ! empty( $s['accent_color'] )     ? $s['accent_color']     : '#c9a84c';
    $hfont   = ! empty( $s['heading_font'] )     ? $s['heading_font']     : 'Playfair Display';
    $bfont   = ! empty( $s['body_font'] )        ? $s['body_font']        : 'Lora';
    $fsize   = ! empty( $s['font_size'] )        ? $s['font_size']        : '16px';

    return "<style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap');
    .{$cls}{font-family:'Inter','Lora',sans-serif;font-size:{$fsize};color:#0f172a;background:{$bg};padding:24px;border-radius:12px;-webkit-font-smoothing:antialiased;}
    .{$cls} h3{font-family:'Playfair Display',Georgia,serif;color:#0f172a;margin:0 0 6px;font-weight:600;letter-spacing:-0.01em;font-size:17px;line-height:1.3;}
    /* Tailwind-style card: bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm hover:shadow-xl */
    .{$cls} .ab-card{background:#ffffff;border:none;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 1px 3px rgba(15,23,42,0.06);outline:1px solid rgba(226,232,240,0.7);outline-offset:-1px;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;}
    .{$cls} .ab-card:hover{transform:translateY(-4px);box-shadow:0 10px 15px -3px rgba(15,23,42,0.08),0 20px 40px -8px rgba(15,23,42,0.12);}
    .{$cls} .ab-cover-wrap{width:100%;aspect-ratio:4/5;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;}
    .{$cls} .ab-cover{width:100%;height:100%;object-fit:contain;display:block;}
    .{$cls} .ab-cover-placeholder{width:100%;aspect-ratio:4/5;background:linear-gradient(135deg,#0a1c33,{$primary});display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.15);font-size:48px;}
    .{$cls} .ab-card-body{padding:18px 20px 20px;display:flex;flex-direction:column;flex:1;}
    .{$cls} .ab-badges{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;}
    .{$cls} .ab-badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;}
    .{$cls} .ab-badge-tone{color:#fff;}
    .{$cls} .ab-badge-time{background:#f1f5f9;color:#475569;}
    .{$cls} .ab-date{font-family:'Inter',sans-serif;font-size:12px;color:#64748b;margin-bottom:10px;font-weight:500;}
    .{$cls} .ab-desc{font-family:'Inter',sans-serif;font-size:13.5px;line-height:1.6;margin-bottom:14px;color:#475569;}
    .{$cls} .ab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px;}
    .{$cls} .ab-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:10px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.2px;text-decoration:none;transition:all 0.2s ease;border:1px solid transparent;}
    .{$cls} .ab-btn:hover{transform:translateY(-1px);}
    .{$cls} .ab-btn-primary{background:#0f172a;color:#fff;box-shadow:0 1px 2px rgba(15,23,42,0.08);}
    .{$cls} .ab-btn-primary:hover{background:#1e293b;box-shadow:0 4px 12px rgba(15,23,42,0.18);}
    .{$cls} .ab-btn-outline{background:#fff;color:#0f172a;border-color:#e2e8f0;}
    .{$cls} .ab-btn-outline:hover{border-color:#cbd5e1;background:#f8fafc;}
    .{$cls} .ab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;}
    .{$cls} .ab-list .ab-item{display:flex;gap:24px;padding:24px 0;border-bottom:1px solid {$text}08;align-items:flex-start;}
    .{$cls} .ab-list .ab-item:last-child{border-bottom:none;}
    .{$cls} .ab-list .ab-item-thumb{width:140px;aspect-ratio:4/5;height:auto;border-radius:10px;object-fit:contain;background:#fff;flex-shrink:0;box-shadow:0 1px 3px rgba(15,28,51,0.04),0 8px 22px rgba(15,28,51,0.08);}
    .{$cls} .ab-list .ab-item-body{flex:1;min-width:0;}
    .{$cls} .ab-magazine-featured{position:relative;border-radius:16px;overflow:hidden;margin-bottom:28px;min-height:340px;display:flex;align-items:flex-end;}
    .{$cls} .ab-magazine-featured .ab-feat-bg{position:absolute;inset:0;background-size:cover;background-position:center;}
    .{$cls} .ab-magazine-featured .ab-feat-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,28,51,0.92) 0%,rgba(10,28,51,0.4) 50%,transparent 100%);}
    .{$cls} .ab-magazine-featured .ab-feat-content{position:relative;z-index:2;padding:36px;color:#fff;width:100%;}
    .{$cls} .ab-magazine-featured h3{color:#fff;font-size:24px;font-family:'Playfair Display',Georgia,serif;font-weight:600;letter-spacing:-0.01em;line-height:1.25;}
    .{$cls} .ab-magazine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;}
    .{$cls} table.ab-table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;}
    .{$cls} table.ab-table th{background:#0f172a;color:#fff;padding:14px 18px;text-align:left;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600;}
    .{$cls} table.ab-table td{padding:14px 18px;border-bottom:1px solid {$text}08;font-size:14px;vertical-align:middle;}
    .{$cls} table.ab-table tr:nth-child(even) td{background:{$primary}03;}
    .{$cls} table.ab-table tr:hover td{background:rgba(201,168,76,0.06);}
    .{$cls} table.ab-table .ab-table-thumb{width:52px;height:65px;border-radius:6px;object-fit:contain;background:#fff;box-shadow:0 2px 6px rgba(15,28,51,0.08);}
    .{$cls} .ab-star{color:{$accent};font-size:12px;}
    </style>";
}

/* ══════════════════════════════════════════════
   Layout renderers
   ══════════════════════════════════════════════ */

function abcontent_card_badges( $item ) {
    $html = '<div class="ab-badges">';
    if ( ! empty( $item['tone'] ) ) {
        $tc = abcontent_tone_color( $item['tone'] );
        $html .= '<span class="ab-badge ab-badge-tone" style="background:' . esc_attr( $tc ) . ';">' . esc_html( $item['tone'] ) . '</span>';
    }
    if ( ! empty( $item['reading_time'] ) ) {
        $html .= '<span class="ab-badge ab-badge-time">' . esc_html( $item['reading_time'] ) . '</span>';
    }
    $html .= '</div>';
    return $html;
}

function abcontent_card_cover( $item, $class = 'ab-cover' ) {
    $cover = ! empty( $item['cover_photo_url'] ) ? $item['cover_photo_url'] : ( ! empty( $item['thumbnail_url'] ) ? $item['thumbnail_url'] : '' );
    if ( $cover ) {
        return '<div class="ab-cover-wrap"><img class="' . $class . '" src="' . esc_url( $cover ) . '" alt="' . esc_attr( $item['title'] ) . '" loading="lazy"></div>';
    }
    return '<div class="ab-cover-placeholder">✝</div>';
}

function abcontent_card_actions( $item, $type ) {
    $base   = abcontent_base_url();
    $paths  = array( 'pastoral_letters' => 'letter', 'homilies' => 'homily', 'writings' => 'writing' );
    $path   = isset( $paths[ $type ] ) ? $paths[ $type ] : 'letter';
    $html   = '<div class="ab-actions">';
    $html  .= '<a class="ab-btn ab-btn-primary" href="' . esc_url( $base . '/' . $path . '/' . $item['id'] ) . '" target="_blank">Read Full</a>';
    if ( ! empty( $item['pdf_url'] ) ) {
        $html .= '<a class="ab-btn ab-btn-outline" href="' . esc_url( abcontent_download_url( $item['pdf_url'] ) ) . '" download target="_blank">Download PDF</a>';
    }
    $html .= '</div>';
    return $html;
}

function abcontent_excerpt( $item, $type, $len = 120 ) {
    $text = '';
    if ( $type === 'writings' && ! empty( $item['body'] ) ) {
        $text = $item['body'];
    } elseif ( ! empty( $item['description'] ) ) {
        $text = $item['description'];
    }
    if ( ! $text ) return '';
    $excerpt = mb_strlen( $text ) > $len ? mb_substr( $text, 0, $len ) . '...' : $text;
    return '<p class="ab-desc">' . esc_html( $excerpt ) . '</p>';
}

/* ── Grid View ────────────────────────────── */

function abcontent_render_grid( $items, $type ) {
    $html = '<div class="ab-grid">';
    foreach ( $items as $item ) {
        $html .= '<div class="ab-card">';
        $html .= abcontent_card_cover( $item );
        $html .= '<div class="ab-card-body">';
        $html .= abcontent_card_badges( $item );
        $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
        $html .= abcontent_excerpt( $item, $type );
        $html .= '<p class="ab-date">' . esc_html( $item['date'] ?? '' ) . '</p>';
        $html .= abcontent_card_actions( $item, $type );
        $html .= '</div></div>';
    }
    $html .= '</div>';
    return $html;
}

/* ── List View ────────────────────────────── */

function abcontent_render_list( $items, $type ) {
    $html = '<div class="ab-list">';
    foreach ( $items as $item ) {
        $cover = ! empty( $item['cover_photo_url'] ) ? $item['cover_photo_url'] : ( ! empty( $item['thumbnail_url'] ) ? $item['thumbnail_url'] : '' );

        $html .= '<div class="ab-item">';
        if ( $cover ) {
            $html .= '<img class="ab-item-thumb" src="' . esc_url( $cover ) . '" alt="' . esc_attr( $item['title'] ) . '" loading="lazy">';
        }
        $html .= '<div class="ab-item-body">';
        $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
        $html .= abcontent_excerpt( $item, $type, 200 );
        $html .= '<div class="ab-badges" style="margin-bottom:8px;">';
        $html .= '<span class="ab-badge ab-badge-time" style="font-size:11px;">' . esc_html( $item['date'] ?? '' ) . '</span>';
        if ( ! empty( $item['tone'] ) ) {
            $tc = abcontent_tone_color( $item['tone'] );
            $html .= ' <span class="ab-badge ab-badge-tone" style="background:' . esc_attr( $tc ) . ';">' . esc_html( $item['tone'] ) . '</span>';
        }
        if ( ! empty( $item['reading_time'] ) ) {
            $html .= ' <span class="ab-badge ab-badge-time">' . esc_html( $item['reading_time'] ) . '</span>';
        }
        if ( ! empty( $item['occasion'] ) ) {
            $html .= ' <span class="ab-badge ab-badge-time">' . esc_html( $item['occasion'] ) . '</span>';
        }
        if ( ! empty( $item['category'] ) ) {
            $html .= ' <span class="ab-badge ab-badge-time">' . esc_html( $item['category'] ) . '</span>';
        }
        $html .= '</div>';
        $html .= abcontent_card_actions( $item, $type );
        $html .= '</div></div>';
    }
    $html .= '</div>';
    return $html;
}

/* ── Magazine View ────────────────────────── */

function abcontent_render_magazine( $items, $type ) {
    if ( empty( $items ) ) return '<p>No content available.</p>';

    $featured = array_shift( $items );
    $cover = ! empty( $featured['cover_photo_url'] ) ? $featured['cover_photo_url'] : ( ! empty( $featured['thumbnail_url'] ) ? $featured['thumbnail_url'] : '' );

    $html = '<div class="ab-magazine-featured">';
    if ( $cover ) {
        $html .= '<div class="ab-feat-bg" style="background-image:url(\'' . esc_url( $cover ) . '\');"></div>';
    } else {
        $html .= '<div class="ab-feat-bg" style="background:linear-gradient(135deg,#1a3c6e,#2a5298);"></div>';
    }
    $html .= '<div class="ab-feat-overlay"></div>';
    $html .= '<div class="ab-feat-content">';
    $html .= abcontent_card_badges( $featured );
    $html .= '<h3>' . esc_html( $featured['title'] ) . '</h3>';
    $html .= '<p class="ab-desc" style="color:rgba(255,255,255,0.85);">' . esc_html( mb_substr( $featured['description'] ?? $featured['body'] ?? '', 0, 180 ) ) . '</p>';
    $html .= abcontent_card_actions( $featured, $type );
    $html .= '</div></div>';

    if ( ! empty( $items ) ) {
        $html .= '<div class="ab-magazine-grid">';
        foreach ( $items as $item ) {
            $html .= '<div class="ab-card">';
            $html .= abcontent_card_cover( $item );
            $html .= '<div class="ab-card-body">';
            $html .= abcontent_card_badges( $item );
            $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
            $html .= '<p class="ab-date">' . esc_html( $item['date'] ?? '' ) . '</p>';
            $html .= abcontent_card_actions( $item, $type );
            $html .= '</div></div>';
        }
        $html .= '</div>';
    }

    return $html;
}

/* ── Table View ───────────────────────────── */

function abcontent_render_table( $items, $type ) {
    $html = '<table class="ab-table"><thead><tr>';
    $html .= '<th>Cover</th><th>Title</th><th>Date</th>';
    if ( $type === 'homilies' ) $html .= '<th>Occasion</th>';
    if ( $type === 'writings' ) $html .= '<th>Category</th>';
    $html .= '<th>Reading Time</th><th>Tone</th><th>Read</th><th>Download</th>';
    $html .= '</tr></thead><tbody>';

    $base  = abcontent_base_url();
    $paths = array( 'pastoral_letters' => 'letter', 'homilies' => 'homily', 'writings' => 'writing' );
    $path  = isset( $paths[ $type ] ) ? $paths[ $type ] : 'letter';

    foreach ( $items as $item ) {
        $cover = ! empty( $item['cover_photo_url'] ) ? $item['cover_photo_url'] : ( ! empty( $item['thumbnail_url'] ) ? $item['thumbnail_url'] : '' );

        $html .= '<tr>';
        $html .= '<td>' . ( $cover ? '<img class="ab-table-thumb" src="' . esc_url( $cover ) . '" alt="">' : '—' ) . '</td>';
        $html .= '<td><strong>' . esc_html( $item['title'] ) . '</strong></td>';
        $html .= '<td>' . esc_html( $item['date'] ?? '—' ) . '</td>';

        if ( $type === 'homilies' ) $html .= '<td>' . esc_html( $item['occasion'] ?? '—' ) . '</td>';
        if ( $type === 'writings' ) $html .= '<td>' . esc_html( $item['category'] ?? '—' ) . '</td>';

        $html .= '<td>' . esc_html( $item['reading_time'] ?? '—' ) . '</td>';

        if ( ! empty( $item['tone'] ) ) {
            $tc = abcontent_tone_color( $item['tone'] );
            $html .= '<td><span style="display:inline-block;padding:2px 10px;border-radius:10px;background:' . esc_attr( $tc ) . ';color:#fff;font-size:11px;font-weight:600;">' . esc_html( $item['tone'] ) . '</span></td>';
        } else {
            $html .= '<td>—</td>';
        }

        $html .= '<td><a class="ab-btn ab-btn-primary" href="' . esc_url( $base . '/' . $path . '/' . $item['id'] ) . '" target="_blank" style="padding:6px 14px;">Read</a></td>';

        if ( ! empty( $item['pdf_url'] ) ) {
            $html .= '<td><a class="ab-btn ab-btn-outline" href="' . esc_url( abcontent_download_url( $item['pdf_url'] ) ) . '" download target="_blank" style="padding:6px 14px;">Download</a></td>';
        } else {
            $html .= '<td>—</td>';
        }

        $html .= '</tr>';
    }

    $html .= '</tbody></table>';
    return $html;
}

/* ══════════════════════════════════════════════
   Master renderer
   ══════════════════════════════════════════════ */

function abcontent_render_section( $content_endpoint, $settings_section, $type ) {
    $items = abcontent_fetch( $content_endpoint );
    if ( is_wp_error( $items ) ) return abcontent_error_notice( $items );
    if ( empty( $items ) ) return '<p style="text-align:center;padding:30px;color:#999;font-style:italic;">No content available at this time.</p>';

    $settings = abcontent_fetch( '/settings/' . $settings_section );
    if ( is_wp_error( $settings ) ) $settings = array();

    $layout = ! empty( $settings['layout'] ) ? $settings['layout'] : 'grid';
    $cls    = 'ab-' . wp_generate_password( 8, false );

    $output = abcontent_style_block( $cls, $settings );
    $output .= '<div class="' . esc_attr( $cls ) . '">';

    $pos = ! empty( $settings['back_button_position'] ) ? $settings['back_button_position'] : 'both';
    if ( $pos === 'top' || $pos === 'both' ) {
        $output .= abcontent_back_button( $settings );
    }

    switch ( $layout ) {
        case 'list':     $output .= abcontent_render_list( $items, $type ); break;
        case 'magazine': $output .= abcontent_render_magazine( $items, $type ); break;
        case 'table':    $output .= abcontent_render_table( $items, $type ); break;
        default:         $output .= abcontent_render_grid( $items, $type ); break;
    }

    if ( $pos === 'bottom' || $pos === 'both' ) {
        $output .= abcontent_back_button( $settings );
    }

    $output .= '</div>';
    return $output;
}

/* ══════════════════════════════════════════════
   Shortcodes
   ══════════════════════════════════════════════ */

add_shortcode( 'archbishop_pastoral_letters', function() {
    return abcontent_render_section( '/pastoral-letters', 'pastoral_letters', 'pastoral_letters' );
});

add_shortcode( 'archbishop_homilies', function() {
    return abcontent_render_section( '/homilies', 'homilies', 'homilies' );
});

add_shortcode( 'archbishop_writings', function() {
    return abcontent_render_section( '/writings', 'writings', 'writings' );
});
