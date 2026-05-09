/**
 * @file src/hooks/token-hud.ts
 * adds the merchant shop button to the token hud
 **/

import { FLAGS, MODULE_ID } from '../module/constants.js';
import { get_flag } from '../module/utils.js';
import { MerchantShop } from '../module/merchant-shop.js';

export const renderTokenHUD = ( hud: any, html: any, _data: any ): void => 
{
	/** 
	 * get the token document. 
	 **/
	const token_doc = hud.document || hud.object?.document;
	if ( !token_doc ) 
	{
		return;
	}

	const is_gm = ( game as any ).user.isGM;
	const is_merchant = get_flag( token_doc, FLAGS.IS_MERCHANT ) ?? false;

	/** 
	 * check if the merchant is dead/defeated.
	 * we check for 0 HP or the defeated status effect.
	 **/
	const actor = hud.object?.actor;
	const is_dead = ( actor?.system?.attributes?.hp?.value <= 0 ) || actor?.statuses?.has( 'dead' ) || actor?.statuses?.has( 'defeated' );
	const disable_when_dead = ( game as any ).settings.get( MODULE_ID, 'disable-when-dead' );

	/** 
	 * universal GM access: always show for GMs.
	 * players only see it for active merchants that aren't dead (if setting enabled).
	 **/
	if ( !is_gm ) 
	{
		if ( !is_merchant ) 
		{
			return;
		}
		if ( disable_when_dead && is_dead ) 
		{
			return;
		}
	}

	/** create the merchant shop button **/
	const shop_btn = document.createElement( 'div' );
	shop_btn.classList.add( 'control-icon', 'yugen-merchant-hud-shop' );
	
	if ( !is_merchant ) 
	{
		/** uninitialized state - GM only **/
		shop_btn.classList.add( 'uninitialized' );
		shop_btn.innerHTML = '<i class="fas fa-store-slash"></i>';
		shop_btn.title = 'Enable Merchant Mode (GM)';
	}
	else 
	{
		/** active merchant state **/
		shop_btn.innerHTML = '<i class="fas fa-shopping-cart"></i>';
		shop_btn.title = ( game as any ).i18n.localize( 'yugen-merchant.buttons.open-shop' );
	}
	
	/** handle button click **/
	shop_btn.onclick = ( event: MouseEvent ) => 
	{
		event.preventDefault( );
		event.stopPropagation( );
		
		/** open the universal merchant shop GUI **/
		new MerchantShop( hud.object ).render( { force: true } );
		
		/** close the HUD to clean up the UI **/
		if ( typeof hud.close === 'function' ) 
		{
			hud.close( );
		}
		else if ( typeof hud.clear === 'function' ) 
		{
			hud.clear( );
		}
	};

	/** 
	 * inject into the HUD HTML.
	 * V14 ApplicationV2 HUDs might pass a raw element or a JQuery wrapper.
	 **/
	const el = html instanceof HTMLElement ? html : html[ 0 ];
	if ( !el ) 
	{
		return;
	}

	/** 
	 * append to the right column if it exists, otherwise the root.
	 **/
	const col_right = el.querySelector( '.col.right' );
	if ( col_right ) 
	{
		col_right.appendChild( shop_btn );
	}
	else 
	{
		el.appendChild( shop_btn );
	}
};
