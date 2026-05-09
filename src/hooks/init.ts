/**
 * @file src/hooks/init.ts
 * initialization hook for registering settings and hooks
 **/

import { MODULE_ID } from '../module/constants.js';
import { renderTokenHUD } from './token-hud.js';
import { SocketHandler } from '../module/socket-handler.js';

export const init_hook = ( ): void => 
{
	Hooks.once( 'init', ( ) => 
	{
		console.log( `${ MODULE_ID } | initializing` );

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
	 * register token hud hook for player interactions.
	 * top-level registration ensures it's caught even if init has already fired.
	 **/
	Hooks.on( 'renderTokenHUD', renderTokenHUD );
};
