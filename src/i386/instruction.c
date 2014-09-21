#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include <malloc.h>
#include "i386_utility.h"
#include "i386_arch.h"
#include "instruction.h"

/***************************************/
/* Instruction private data defination */
/***************************************/

typedef struct _private_instruction_t {
	unsigned char legacy_prefix;
	unsigned char rex_prefix;
	union {
		unsigned int value;
		unsigned char octets[4];
	} op_code;
	unsigned modrm_mod:2;
	unsigned modrm_reg:3;
	unsigned modrm_rm:3;
	unsigned char sib;
	union {
		unsigned int value;
		unsigned char octets[8];
	} displacement;
	int displacement_len;
	union {
		unsigned int value;
		unsigned char octets[8];
	} imm;
	int imm_len;

	unsigned char instruction_codes[15];
	unsigned char instruction_len;
} private_instruction_t;

/***************************************/
/* Instruction operation functions map */
/***************************************/

int call_op( instruction_t * p_inst );
int move_op( instruction_t * p_inst );
int push_op( instruction_t * p_inst );
int grp1_op( instruction_t * p_inst );

typedef int (*instruction_oper_ftype)( instruction_t * p_inst );

instruction_oper_ftype op_array[256] = {
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
push_op,push_op,0,		push_op,0,		push_op,push_op,0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		grp1_op,0,		0,		0,		0,		0,move_op,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0, move_op,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,call_op,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
};

/***************************************/
/* Group 1 operation functions map     */
/***************************************/

int sub_op( instruction_t * p_inst );

instruction_oper_ftype grp1_op_array[8] = {
0,		0,		0,		0,		0,	sub_op,		0,		0
};

/***************************************/
/* Instruction decode functions map    */
/***************************************/

/***************************************/
/* Decode function name rules:         */
/* 1. decode+element number+elements   */
/* 2. o: operation code                */
/*    d: displacement                  */
/*    i: immediate                     */
/*    m: modrm                         */
/* For example,                        */
/* d1o   = decode 1 element, element   */
/* is operation code                   */
/* d3omi = decode 3 elements, elements */
/* are operation code, modrm and       */
/* immediate                           */
/***************************************/

void d1o( instruction_t * p_inst );
void d2od( instruction_t * p_inst );
void d2oi( instruction_t * p_inst );
void d2om( instruction_t * p_inst );
void d3omi( instruction_t * p_inst );

typedef void (*instruction_decode_ftype)( instruction_t * p_inst );

instruction_decode_ftype decode_array[256] = {
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
d1o,	d1o,	0,		d1o,	0,		d1o,	d1o,	0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		d3omi,	0,		0,		0,		0,		0,		d2om,	0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		d2oi,	0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,	d2od,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
};

/********************************************/
/* Instruction operation function implement */
/********************************************/

void push( int value )
{
	registers[ESP] -= 4;
			
	if ( registers[ESP] < MEMORY_SIZE ) {
		*((int *) (phy_memory + registers[ESP])) = value;
	} else {
		printf("Fatal error, memory overflow\n");
		exit(1);
	}
}

int call_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	push( registers[EIP] );
	registers[EIP] += p->displacement.value;

	return 0;
}

int move_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	switch ( p->op_code.octets[0] )
	{
	case 0x89:
		if ( p->modrm_mod == 0x3 ) {
			registers[ p->modrm_rm + 1 ] = registers[ p->modrm_reg + 1 ];
		} else {
			printf("Fatal error. Invalid instruction\n");
			exit( 1 );
		}
		break;
	case 0xbc:
		registers[ESP] = p->imm.value;
		break;
	default:
		return -1;
	}
	
	return 0;
}

int push_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	switch ( p->op_code.octets[0] )
	{
	case 0x50:
		push( registers[EAX] );
		break;
	case 0x51:
		push( registers[ECX] );
		break;
	case 0x53:
		push( registers[EBX] );
		break;
	case 0x55:
		push( registers[EBP] );
		break;
	case 0x56:
		push( registers[ESI] );
		break;
	default:
		return -1;
	}

	return 0;
}

int sub_op( instruction_t * p_inst )
{
}

int grp1_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	switch ( p->op_code.octets[0] )
	{
	case 0x83:
		{
			if ( grp1_op_array[p->modrm_reg] ) {
				grp1_op_array[p->modrm_reg]( p_inst );
			} else {
				printf("Fatal error. Invalid instruction\n");
				exit( 1 );
			}
			break;
		}
	default:
		return -1;
	}

	return 0;
}

/*****************************************/
/* Instruction decode function implement */
/*****************************************/

void _decode_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->op_code.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );

	p->instruction_codes[ p->instruction_len ] = p->op_code.octets[0];
	p->instruction_len += 1;
}

void _decode_dis( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->displacement.value = fetch_int( phy_memory, registers[EIP] + p->instruction_len );
	p->displacement_len = 4;

	memcpy( p->instruction_codes + p->instruction_len, &p->displacement, 4 );
	p->instruction_len += 4;
}

void _decode_imm( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->imm.value = fetch_int( phy_memory, registers[EIP] + p->instruction_len );
	p->imm_len = 4;

	memcpy( p->instruction_codes + p->instruction_len, &p->imm, 4 );
	p->instruction_len += 4;
}

void _decode_m( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	unsigned char modrm = 0;

	modrm = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->modrm_mod = modrm >> 6;
	p->modrm_reg = (modrm & 0x3f) >> 3;
	p->modrm_rm = modrm & 0x7;

	p->instruction_codes[ p->instruction_len ] = modrm;
	p->instruction_len += 1;
}

void _decode_immb( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->imm.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->imm_len = 1;

	p->instruction_codes[ p->instruction_len ] = p->imm.octets[0];
	p->instruction_len += 1;
}

void d1o( instruction_t * p_inst )
{
	_decode_op( p_inst );
}

void d2od( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_dis( p_inst );
}

void d2oi( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_imm( p_inst );
}

void d2om( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
}

void d3omi( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
	_decode_immb( p_inst );
}

/***************************************/
/* Instruction class implementation    */
/***************************************/

void instruction_construct( instruction_t * p_inst )
{
	p_inst->priv = ( private_instruction_t * ) malloc( sizeof(private_instruction_t) );
	memset( p_inst->priv, '\0', sizeof( private_instruction_t ) );
}

void instruction_destruct( instruction_t * p_inst )
{
	free( p_inst->priv );
}

void instruction_decode( instruction_t * p_inst )
{
	unsigned char instruction_octet = fetch_char( phy_memory, registers[EIP] );
	instruction_decode_ftype p_decode_f = decode_array[ instruction_octet ];

	if ( p_decode_f ) {
		p_decode_f( p_inst );
	} else {
		printf( "Fatal error, unknown instruction\n" );
		exit( 1 );
	}
}

void instruction_run( instruction_t * p_inst )
{
	static int instruction_counter = 0;
	private_instruction_t * p = p_inst->priv;
	instruction_oper_ftype p_op = op_array[ p->op_code.octets[0] ];

	if ( p_op ) {
		p_op( p_inst );
	} else {
		printf( "Fatal error, unknown instruction\n" );
		exit( 1 );
	}

	registers[EIP] += p->instruction_len;

	dump_instruction( ++instruction_counter, p->instruction_codes, p->instruction_len );
	dump_registers();
}
