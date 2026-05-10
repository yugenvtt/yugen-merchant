/**
 * @file src/module/merchant-item-editor.ts
 * popup editor for virtual merchant items (v12-v14 compatible)
 **/

import { MODULE_ID, FLAGS } from './constants.js';
import { set_flag } from './utils.js';

export class MerchantItemEditor extends ( ( FormApplication ?? class { } ) as any ) 
{
	private token_doc: any;
	private item_index: number;
	private item_data: any;
	private on_save: Function;

	constructor( token_doc: any, item_index: number, options: any = { }, on_save: Function ) 
	{
		const inventory = token_doc.getFlag( MODULE_ID, FLAGS.INVENTORY ) ?? [ ];
		const item = inventory[ item_index ];
		
		super( item, options );
		this.token_doc = token_doc;
		this.item_index = item_index;
		this.item_data = item;
		this.on_save = on_save;
	}

	static get defaultOptions( ) 
	{
		return ( foundry.utils as any ).mergeObject( super.defaultOptions, {
			id: 'yugen-merchant-item-editor',
			title: 'Merchant Item Editor',
			template: 'modules/yugen-merchant/templates/item-editor.hbs',
			width: 450,
			height: 'auto',
			closeOnSubmit: true,
			resizable: true
		} );
	}

	async getData( ) 
	{
		return {
			item: this.item_data
		};
	}

	activateListeners( html: any ) 
	{
		super.activateListeners( html );
		const el = html[ 0 ];

		/** handle price randomization - forced whole numbers **/
		el.querySelector( '.randomize-price' )?.addEventListener( 'click', ( ) => 
		{
			const min = Math.ceil( parseFloat( ( el.querySelector( '.price-min' ) as HTMLInputElement ).value ) || 0 );
			const max = Math.floor( parseFloat( ( el.querySelector( '.price-max' ) as HTMLInputElement ).value ) || 100 );
			
			const val = Math.floor( Math.random( ) * ( max - min + 1 ) ) + min;
			( el.querySelector( 'input[name="price"]' ) as HTMLInputElement ).value = val.toString( );
		} );

		/** handle stock randomization - forced whole numbers **/
		el.querySelector( '.randomize-stock' )?.addEventListener( 'click', ( ) => 
		{
			const min = Math.ceil( parseInt( ( el.querySelector( '.stock-min' ) as HTMLInputElement ).value ) || 1 );
			const max = Math.floor( parseInt( ( el.querySelector( '.stock-max' ) as HTMLInputElement ).value ) || 10 );
			
			const val = Math.floor( Math.random( ) * ( max - min + 1 ) ) + min;
			( el.querySelector( 'input[name="quantity"]' ) as HTMLInputElement ).value = val.toString( );
		} );
	}

	async _updateObject( _event: any, form_data: any ) 
	{
		const inventory = ( foundry.utils as any ).duplicate( this.token_doc.getFlag( MODULE_ID, FLAGS.INVENTORY ) ?? [ ] );
		const item = inventory[ this.item_index ];
		
		if ( !item ) 
		{
			return;
		}

		item.system.price.value = Math.floor( form_data.price );
		item.system.price.denomination = form_data.denomination;
		item.system.quantity = Math.floor( form_data.quantity );

		await set_flag( this.token_doc, FLAGS.INVENTORY, inventory, { render: false } );

		if ( this.on_save ) 
		{
			this.on_save( );
		}
	}
}
