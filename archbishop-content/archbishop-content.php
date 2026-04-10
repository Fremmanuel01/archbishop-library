<?php
/**
 * Plugin Name: Archbishop Content
 * Plugin URI:  https://archbishopokeke.com
 * Description: Displays pastoral letters, homilies, and writings from the Archbishop Library CMS via shortcodes.
 * Version:     1.0.0
 * Author:      Archbishop Library CMS
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */

define( 'ABCONTENT_VERSION', '1.0.0' );
define( 'ABCONTENT_CACHE_TTL', 300 ); // 5 minutes

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
            <thead>
                <tr><th>Shortcode</th><th>Description</th></tr>
            </thead>
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
   API helper — fetch with transient caching
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
   Error notice renderer
   ══════════════════════════════════════════════ */

function abcontent_error_notice( $error ) {
    $message = is_wp_error( $error ) ? $error->get_error_message() : 'Unable to load content.';
    return '<div style="border:1px solid #e0c29a;background:#fff8ed;color:#8b6914;padding:16px 20px;
            border-radius:8px;font-family:Georgia,serif;font-size:15px;text-align:center;margin:20px 0;">
            <strong>Notice:</strong> ' . esc_html( $message ) .
           ' <br><small>Please check back shortly.</small></div>';
}

/* ══════════════════════════════════════════════
   Render the "back" button
   ══════════════════════════════════════════════ */

function abcontent_back_button( $settings ) {
    if ( empty( $settings['back_button_label'] ) || empty( $settings['back_button_url'] ) ) {
        return '';
    }

    /* Visibility check */
    $vis  = isset( $settings['back_button_visibility'] ) ? $settings['back_button_visibility'] : 'both';
    $host = isset( $_SERVER['HTTP_HOST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';

    if ( $vis === 'admissions' && strpos( $host, 'admissions' ) === false ) {
        return '';
    }
    if ( $vis === 'archdiocese' && strpos( $host, 'admissions' ) !== false ) {
        return '';
    }

    $color = ! empty( $settings['back_button_color'] ) ? $settings['back_button_color'] : '#c9a84c';
    $font  = ! empty( $settings['body_font'] ) ? $settings['body_font'] : 'Lora';

    return '<div style="margin:12px 0;">
        <a href="' . esc_url( $settings['back_button_url'] ) . '"
           style="display:inline-block;padding:10px 22px;background:' . esc_attr( $color ) . ';
                  color:#fff;text-decoration:none;border-radius:6px;font-size:14px;
                  font-family:\'' . esc_attr( $font ) . '\',serif;font-weight:600;
                  transition:opacity 0.2s;"
           onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">
           ' . esc_html( $settings['back_button_label'] ) . '
        </a>
    </div>';
}

/* ══════════════════════════════════════════════
   Scoped style block generator
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
    @import url('https://fonts.googleapis.com/css2?family=" . urlencode( $hfont ) . ":wght@400;600;700&family=" . urlencode( $bfont ) . ":wght@400;500;600&display=swap');
    .{$cls}{font-family:'{$bfont}',serif;font-size:{$fsize};color:{$text};background:{$bg};padding:20px;border-radius:8px;}
    .{$cls} h3{font-family:'{$hfont}',serif;color:{$primary};margin:0 0 4px;}
    .{$cls} .ab-card{background:{$bg};border:1px solid {$primary}22;border-radius:8px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);transition:transform 0.2s,box-shadow 0.2s;}
    .{$cls} .ab-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.1);}
    .{$cls} .ab-thumb{width:100%;height:160px;object-fit:cover;border-radius:6px;margin-bottom:12px;background:{$primary}10;}
    .{$cls} .ab-date{font-size:13px;color:{$text}99;margin-bottom:6px;}
    .{$cls} .ab-desc{font-size:14px;line-height:1.6;margin-bottom:10px;}
    .{$cls} .ab-btn{display:inline-block;padding:8px 18px;background:{$accent};color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;transition:opacity 0.2s;}
    .{$cls} .ab-btn:hover{opacity:0.85;}
    .{$cls} .ab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}
    .{$cls} .ab-list .ab-item{padding:16px 0;border-bottom:1px solid {$text}15;}
    .{$cls} .ab-list .ab-item:last-child{border-bottom:none;}
    .{$cls} .ab-magazine-featured{background:{$primary}08;border-radius:8px;padding:24px;margin-bottom:20px;}
    .{$cls} .ab-magazine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;}
    .{$cls} table.ab-table{width:100%;border-collapse:collapse;}
    .{$cls} table.ab-table th{background:{$primary};color:#fff;padding:12px 16px;text-align:left;font-family:'{$hfont}',serif;font-size:14px;}
    .{$cls} table.ab-table td{padding:12px 16px;border-bottom:1px solid {$text}10;font-size:14px;}
    .{$cls} table.ab-table tr:nth-child(even) td{background:{$primary}05;}
    .{$cls} table.ab-table tr:hover td{background:{$accent}10;}
    </style>";
}

/* ══════════════════════════════════════════════
   Layout renderers
   ══════════════════════════════════════════════ */

function abcontent_render_grid( $items, $type ) {
    $html = '<div class="ab-grid">';
    foreach ( $items as $item ) {
        $thumb = '';
        if ( ! empty( $item['thumbnail_url'] ) ) {
            $thumb = '<img class="ab-thumb" src="' . esc_url( $item['thumbnail_url'] ) . '" alt="' . esc_attr( $item['title'] ) . '">';
        } else {
            $thumb = '<div class="ab-thumb"></div>';
        }

        $desc = '';
        if ( $type === 'writings' && ! empty( $item['body'] ) ) {
            $desc = '<p class="ab-desc">' . esc_html( wp_trim_words( $item['body'], 25 ) ) . '</p>';
        } elseif ( ! empty( $item['description'] ) ) {
            $desc = '<p class="ab-desc">' . esc_html( wp_trim_words( $item['description'], 25 ) ) . '</p>';
        }

        $action = '';
        if ( ! empty( $item['pdf_url'] ) ) {
            $action = '<a class="ab-btn" href="' . esc_url( $item['pdf_url'] ) . '" target="_blank">Download PDF</a>';
        } elseif ( $type === 'writings' ) {
            $action = '<a class="ab-btn" href="#" onclick="return false;">Read More</a>';
        }

        $html .= '<div class="ab-card">';
        $html .= $thumb;
        $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
        $html .= '<p class="ab-date">' . esc_html( $item['date'] ?? '' ) . '</p>';
        $html .= $desc;
        $html .= $action;
        $html .= '</div>';
    }
    $html .= '</div>';
    return $html;
}

function abcontent_render_list( $items, $type ) {
    $html = '<div class="ab-list">';
    foreach ( $items as $item ) {
        $desc = '';
        if ( $type === 'writings' && ! empty( $item['body'] ) ) {
            $desc = '<p class="ab-desc">' . esc_html( wp_trim_words( $item['body'], 30 ) ) . '</p>';
        } elseif ( ! empty( $item['description'] ) ) {
            $desc = '<p class="ab-desc">' . esc_html( wp_trim_words( $item['description'], 30 ) ) . '</p>';
        }

        $action = '';
        if ( ! empty( $item['pdf_url'] ) ) {
            $action = ' <a class="ab-btn" href="' . esc_url( $item['pdf_url'] ) . '" target="_blank">Download PDF</a>';
        }

        $html .= '<div class="ab-item">';
        $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
        $html .= '<p class="ab-date">' . esc_html( $item['date'] ?? '' );
        if ( ! empty( $item['occasion'] ) ) {
            $html .= ' &middot; ' . esc_html( $item['occasion'] );
        }
        if ( ! empty( $item['category'] ) ) {
            $html .= ' &middot; ' . esc_html( $item['category'] );
        }
        $html .= '</p>';
        $html .= $desc;
        $html .= $action;
        $html .= '</div>';
    }
    $html .= '</div>';
    return $html;
}

function abcontent_render_magazine( $items, $type ) {
    if ( empty( $items ) ) {
        return '<p>No content available.</p>';
    }

    $featured = array_shift( $items );
    $html = '';

    /* Featured item */
    $html .= '<div class="ab-magazine-featured">';
    if ( ! empty( $featured['thumbnail_url'] ) ) {
        $html .= '<img class="ab-thumb" src="' . esc_url( $featured['thumbnail_url'] ) . '" alt="' . esc_attr( $featured['title'] ) . '" style="height:220px;">';
    }
    $html .= '<h3 style="font-size:22px;">' . esc_html( $featured['title'] ) . '</h3>';
    $html .= '<p class="ab-date">' . esc_html( $featured['date'] ?? '' ) . '</p>';

    $desc = '';
    if ( $type === 'writings' && ! empty( $featured['body'] ) ) {
        $desc = esc_html( wp_trim_words( $featured['body'], 50 ) );
    } elseif ( ! empty( $featured['description'] ) ) {
        $desc = esc_html( wp_trim_words( $featured['description'], 50 ) );
    }
    if ( $desc ) {
        $html .= '<p class="ab-desc">' . $desc . '</p>';
    }

    if ( ! empty( $featured['pdf_url'] ) ) {
        $html .= '<a class="ab-btn" href="' . esc_url( $featured['pdf_url'] ) . '" target="_blank">Download PDF</a>';
    }
    $html .= '</div>';

    /* Remaining items in grid */
    if ( ! empty( $items ) ) {
        $html .= '<div class="ab-magazine-grid">';
        foreach ( $items as $item ) {
            $html .= '<div class="ab-card">';
            $html .= '<h3>' . esc_html( $item['title'] ) . '</h3>';
            $html .= '<p class="ab-date">' . esc_html( $item['date'] ?? '' ) . '</p>';
            if ( ! empty( $item['pdf_url'] ) ) {
                $html .= '<a class="ab-btn" href="' . esc_url( $item['pdf_url'] ) . '" target="_blank" style="margin-top:8px;">Download</a>';
            }
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    return $html;
}

function abcontent_render_table( $items, $type ) {
    $html = '<table class="ab-table">';
    $html .= '<thead><tr>';
    $html .= '<th>Title</th><th>Date</th>';
    if ( $type === 'homilies' ) {
        $html .= '<th>Occasion</th>';
    }
    if ( $type === 'writings' ) {
        $html .= '<th>Category</th>';
    }
    $html .= '<th>Description</th>';
    if ( $type !== 'writings' ) {
        $html .= '<th>Download</th>';
    }
    $html .= '</tr></thead><tbody>';

    foreach ( $items as $item ) {
        $html .= '<tr>';
        $html .= '<td><strong>' . esc_html( $item['title'] ) . '</strong></td>';
        $html .= '<td>' . esc_html( $item['date'] ?? '—' ) . '</td>';

        if ( $type === 'homilies' ) {
            $html .= '<td>' . esc_html( $item['occasion'] ?? '—' ) . '</td>';
        }
        if ( $type === 'writings' ) {
            $html .= '<td>' . esc_html( $item['category'] ?? '—' ) . '</td>';
        }

        $desc = '';
        if ( $type === 'writings' && ! empty( $item['body'] ) ) {
            $desc = wp_trim_words( $item['body'], 15 );
        } elseif ( ! empty( $item['description'] ) ) {
            $desc = wp_trim_words( $item['description'], 15 );
        }
        $html .= '<td>' . esc_html( $desc ?: '—' ) . '</td>';

        if ( $type !== 'writings' ) {
            if ( ! empty( $item['pdf_url'] ) ) {
                $html .= '<td><a class="ab-btn" href="' . esc_url( $item['pdf_url'] ) . '" target="_blank">PDF</a></td>';
            } else {
                $html .= '<td>—</td>';
            }
        }

        $html .= '</tr>';
    }

    $html .= '</tbody></table>';
    return $html;
}

/* ══════════════════════════════════════════════
   Master shortcode renderer
   ══════════════════════════════════════════════ */

function abcontent_render_section( $content_endpoint, $settings_section, $type ) {
    /* Fetch content */
    $items = abcontent_fetch( $content_endpoint );
    if ( is_wp_error( $items ) ) {
        return abcontent_error_notice( $items );
    }

    if ( empty( $items ) ) {
        return '<p style="text-align:center;padding:30px;color:#999;font-style:italic;">No content available at this time.</p>';
    }

    /* Fetch settings */
    $settings = abcontent_fetch( '/settings/' . $settings_section );
    if ( is_wp_error( $settings ) ) {
        $settings = array(); // fall back to defaults
    }

    $layout = ! empty( $settings['layout'] ) ? $settings['layout'] : 'grid';
    $cls    = 'ab-' . wp_generate_password( 8, false );

    /* Build output */
    $output = abcontent_style_block( $cls, $settings );
    $output .= '<div class="' . esc_attr( $cls ) . '">';

    /* Top back button */
    $pos = ! empty( $settings['back_button_position'] ) ? $settings['back_button_position'] : 'both';
    if ( $pos === 'top' || $pos === 'both' ) {
        $output .= abcontent_back_button( $settings );
    }

    /* Render layout */
    switch ( $layout ) {
        case 'list':
            $output .= abcontent_render_list( $items, $type );
            break;
        case 'magazine':
            $output .= abcontent_render_magazine( $items, $type );
            break;
        case 'table':
            $output .= abcontent_render_table( $items, $type );
            break;
        default:
            $output .= abcontent_render_grid( $items, $type );
            break;
    }

    /* Bottom back button */
    if ( $pos === 'bottom' || $pos === 'both' ) {
        $output .= abcontent_back_button( $settings );
    }

    $output .= '</div>';

    return $output;
}

/* ══════════════════════════════════════════════
   Shortcode registrations
   ══════════════════════════════════════════════ */

add_shortcode( 'archbishop_pastoral_letters', 'abcontent_pastoral_letters_shortcode' );

function abcontent_pastoral_letters_shortcode() {
    return abcontent_render_section( '/pastoral-letters', 'pastoral_letters', 'pastoral_letters' );
}

add_shortcode( 'archbishop_homilies', 'abcontent_homilies_shortcode' );

function abcontent_homilies_shortcode() {
    return abcontent_render_section( '/homilies', 'homilies', 'homilies' );
}

add_shortcode( 'archbishop_writings', 'abcontent_writings_shortcode' );

function abcontent_writings_shortcode() {
    return abcontent_render_section( '/writings', 'writings', 'writings' );
}
