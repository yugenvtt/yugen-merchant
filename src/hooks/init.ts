/**
 * @file src/hooks/init.ts
 * initialization hook for registering settings and hooks
 **/

import { MODULE_ID, FLAGS } from '../module/constants.js';
import { render_token_hud } from './token-hud.js';
import { SocketHandler } from '../module/socket-handler.js';
import { get_flag } from '../module/utils.js';
import { MerchantShop } from '../module/merchant-shop.js';

export const init_hook = ( ): void => 
{
	Hooks.once( 'init', ( ) => 
	{
		/** 
		 * wrap token permission checks early.
		 * permit HUD and view interactions for merchants even without observer/owner permissions.
		 **/
		const proto = ( Token as any ).prototype;

		const original_can = proto.can;
		proto.can = function( user: any, action: string ) 
		{
			if ( [ 'HUD', 'view' ].includes( action ) ) 
			{
				const is_merchant = get_flag( this.document, FLAGS.IS_MERCHANT );
				if ( is_merchant ) 
				{
					return true;
				}
			}
			return original_can.call( this, user, action );
		};

		/** 
		 * wrap token double-click interaction.
		 * if a player (non-owner) double-clicks a merchant, show the shop.
		 **/
		const original_on_click_left_2 = proto._onClickLeft2;
		proto._onClickLeft2 = function( event: any ) 
		{
			const is_merchant = get_flag( this.document, FLAGS.IS_MERCHANT ) ?? false;
			const is_owner = this.actor?.testUserPermission( ( game as any ).user, 'OWNER' );

			if ( is_merchant && !is_owner && !( game as any ).user.isGM ) 
			{
				new MerchantShop( this ).render( { force: true } );
				return;
			}

			return original_on_click_left_2.call( this, event );
		};

		/** register module settings **/
		( game as any ).settings.register( MODULE_ID, 'default-buy-multiplier', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.buy-multiplier.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.buy-multiplier.hint' ),
			scope: 'world',
			config: true,
			type: Number,
			default: 1.0
		} );

		( game as any ).settings.register( MODULE_ID, 'default-sell-multiplier', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.sell-multiplier.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.sell-multiplier.hint' ),
			scope: 'world',
			config: true,
			type: Number,
			default: 0.5
		} );

		( game as any ).settings.register( MODULE_ID, 'item-types', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.item-types.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.item-types.hint' ),
			scope: 'world',
			config: true,
			type: String,
			default: 'weapon,armor,equipment,consumable,treasure,backpack,tool'
		} );

		( game as any ).settings.register( MODULE_ID, 'disable-when-dead', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.disable-when-dead.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.disable-when-dead.hint' ),
			scope: 'world',
			config: true,
			type: Boolean,
			default: true
		} );

		( game as any ).settings.register( MODULE_ID, 'allow-zero-value', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.allow-zero-value.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.allow-zero-value.hint' ),
			scope: 'world',
			config: true,
			type: Boolean,
			default: false
		} );

		( game as any ).settings.register( MODULE_ID, 'randomize-quantity', {
			name: ( game as any ).i18n.localize( 'yugen-merchant.settings.randomize-quantity.name' ),
			hint: ( game as any ).i18n.localize( 'yugen-merchant.settings.randomize-quantity.hint' ),
			scope: 'world',
			config: true,
			type: Boolean,
			default: true
		} );

		( game as any ).settings.register( MODULE_ID, 'debug-mode', {
			name: 'Debug Mode',
			hint: 'Enable verbose logging for troubleshooting pricing and inventory issues.',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false
		} );
	} );

	Hooks.once( 'ready', ( ) => 
	{
		/** register sockets **/
		SocketHandler.register( );
	} );

	/**
	 * force merchant tokens to be interactive even if not owned.
	 **/
	Hooks.on( 'refreshToken', ( token: any ) => 
	{
		const is_merchant = get_flag( token.document, FLAGS.IS_MERCHANT );
		if ( is_merchant ) 
		{
			/** use PIXI eventMode for V14 compatibility **/
			if ( token.eventMode !== 'static' ) 
			{
				token.eventMode = 'static';
				token.cursor = 'pointer';
			}

			/** add a direct pointerup listener as a fail-safe for double clicks **/
			if ( !token._merchantClickBound ) 
			{
				token.on( 'pointerup', ( ) => 
				{
					const now = Date.now( );
					const last = token._lastClickTime || 0;
					token._lastClickTime = now;

					/** manual double-click detection (within 250ms) **/
					if ( ( now - last ) < 250 ) 
					{
						const is_owner = token.actor?.testUserPermission( ( game as any ).user, 'OWNER' );
						if ( !is_owner && !( game as any ).user.isGM ) 
						{
							if ( MerchantShop.check_proximity( token ) ) 
							{
								new MerchantShop( token ).render( { force: true } );
							}
						}
					}
				} );
				token._merchantClickBound = true;
			}
		}
	} );

	/** 
	 * register token hud hook for player interactions.
	 * top-level registration ensures it's caught even if init has already fired.
	 **/
	Hooks.on( 'renderTokenHUD', render_token_hud );
};
