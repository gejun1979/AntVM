#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include <malloc.h>
#include "i386_utility.h"
#include "i386_arch.h"
#include "i386_port_action_map.h"
#include "instruction.h"

/*****************************************************/
/* Instruction class implementation                  */
/*****************************************************/

/*****************************************************/
/* This file contains 6 part                         */
/* 1. Instruction class private data definition;     */
/* 2. Instruction operation function map;            */
/* 3. Instruction decode function map;               */
/* 4. Instruction operation function implementation; */
/* 5. Instruction decode function implementation;    */
/* 6. Instruction class method implementation.       */
/*****************************************************/

/****************************************************/
/* Part1: Instruction class private data definition */
/****************************************************/

typedef struct _private_instruction_t {
	char legacy_prefix;
	char rex_prefix;

	union {
		int value;
		unsigned char octets[4];
	} op_code;
	int op_code_len;

	union {
		char value;
		struct {
			unsigned rm:3;
			unsigned reg:3;
			unsigned mod:2;
		} m;
	} modrm;

	union {
		char value;
		struct {
			unsigned base:3;
			unsigned index:3;
			unsigned scale:2;
		} s;
	} sib;

	union {
		int value;
		unsigned char octets[8];
	} displacement;
	int displacement_len;

	union {
		int value;
		unsigned char octets[8];
	} imm;
	int imm_len;

	char instruction_codes[15];
	int instruction_len;
} private_instruction_t;

/********************************************/
/* Part2 Instruction operation function map */
/********************************************/

int add_op( private_instruction_t * p );
int sub_op( private_instruction_t * p );
int cmp_op( private_instruction_t * p );
int test_op( private_instruction_t * p );
int je( private_instruction_t * p );
int jne( private_instruction_t * p );
int jb( private_instruction_t * p );
int call_op( private_instruction_t * p );
int ret_op( private_instruction_t * p );
int mov_op( private_instruction_t * p );
int mov_rx_Iv( private_instruction_t * p );
int mov_Gv_Ev( private_instruction_t * p );
int mov_Ev_Gv( private_instruction_t * p );
int movsx_Gv_Eb( private_instruction_t * p );
int movzx_Gv_Eb( private_instruction_t * p );
int grp11_mov_Ev_Iz( private_instruction_t * p );
int push_op( private_instruction_t * p );
int pop_op( private_instruction_t * p );
int grp1_op( private_instruction_t * p );
int inst_2b_op( private_instruction_t * p );
int out_op( private_instruction_t * p );

typedef int (*instruction_oper_ftype)( private_instruction_t * p );

instruction_oper_ftype op_array_2bytes[256] = {
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		movzx_Gv_Eb,0,		0,		0,		0,		0,		0,		0,		movsx_Gv_Eb,0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,			0,
};

instruction_oper_ftype op_array_1byte[256] = {
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			inst_2b_op,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
push_op,push_op,push_op,push_op,push_op,push_op,push_op,push_op,pop_op,pop_op,pop_op,pop_op,pop_op,pop_op,pop_op,pop_op,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		je,		jne,	0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		grp1_op,test_op,0,		0,		0,				0,			mov_Ev_Gv,	0,			mov_Gv_Ev,	0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,	mov_rx_Iv,
0,		0,		0,		ret_op,		0,		0,		0,		grp11_mov_Ev_Iz,0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
0,		0,		0,		0,		0,		0,		0,		0,				call_op,	0,			0,			jb,			0,			0,			out_op,			0,
0,		0,		0,		0,		0,		0,		0,		0,				0,			0,			0,			0,			0,			0,			0,			0,
};

/***************************************/
/* Group 1 operation functions map     */
/***************************************/

instruction_oper_ftype grp1_op_array[8] = {
add_op,	0,		0,		0,		0,	sub_op,		0,		cmp_op
};

/*****************************************/
/* Part3 Instruction decode function map */
/*****************************************/

/***************************************/
/* Decode function name rules:         */
/* 1. decode+element number+elements   */
/* 2. o: operation code                */
/*    d: displacement                  */
/*    i: immediate                     */
/*    s: sib                           */
/*    m: modrm                         */
/* For example,                        */
/* d1o    = decode 1 element, element  */
/* is operation code                   */
/* d3omi8 = decode 3 elements,         */
/* elements are operation code, modrm  */
/* and byte immediate                  */
/***************************************/

void d1o( private_instruction_t * p );
void d2od8( private_instruction_t * p );
void d2od32( private_instruction_t * p );
void d2oi32( private_instruction_t * p );
void d2om( private_instruction_t * p );
void d3omi8( private_instruction_t * p );
void d3omd( private_instruction_t * p );
void d5omsdi32( private_instruction_t * p );
void d_inst2( private_instruction_t * p ); //decode 2 bytes instruction

typedef void (*instruction_decode_ftype)( private_instruction_t * p );

instruction_decode_ftype decode_array_2bytes[256] = {
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		d2om,	0,			0,		0,		0,		0,		0,		0,		d2om,	0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
};

instruction_decode_ftype decode_array_1byte[256] = {
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		d_inst2,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		d2od8,	d2od8,	0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		d3omi8,	d2om,	0,		0,		0,			0,		d2om,	0,		d3omd,	0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,
0,		0,		0,		d1o,		0,		0,		0,		d5omsdi32,	0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			d2od32,	0,		0,		d2od8,	0,		0,		d1o,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
};

/*******************************************************/
/* Part4 Instruction operation function implementation */
/*******************************************************/

unsigned int calculate_base_offset( private_instruction_t * p )
{
 unsigned int base = 0;
 
 if ( p->modrm.m.mod == 3 ) {
  ant_log(error, "Fatal error. Invalid mod value in %s\n", __FUNCTION__ );
  dump_instruction( -1, p->instruction_codes, p->instruction_len );
  exit( 1 );
 }
 
 if ( base != 0x5 ) {
  base = registers[p->sib.s.index + 1];
 } else {
  if ( p->modrm.m.mod == 0 ) {
   base = p->displacement.value;
  } else {
   base = registers[p->sib.s.index + 1] + p->displacement.value;
  }
 }
 
 return base;
}

unsigned int calculate_sib_offset( private_instruction_t * p )
{
 unsigned int base = calculate_base_offset( p );
 unsigned int sib_offset = 0;

 if ( p->sib.s.index == 4 ) {
  sib_offset = base;
 } else {
  sib_offset = base + registers[p->sib.s.index + 1] * ( 1 << p->sib.s.scale );
 }
 
 return sib_offset;
}

void push( int value )
{
	registers[ESP] -= 4;

	if ( registers[ESP] < MEMORY_SIZE ) {
		*((int *) (phy_memory + registers[ESP])) = value;
		return;
	}

	ant_log(error, "Fatal error, memory overflow\n");
	exit(1);
}

void pop( int * p_value )
{
	*p_value = *((int *) (phy_memory + registers[ESP]));
	registers[ESP] += 4;
}

int call_op( private_instruction_t * p )
{
 registers[EIP] += p->instruction_len;

	push( registers[EIP] );
	registers[EIP] += p->displacement.value;

	return 0;
}

int ret_op( private_instruction_t * p )
{
 pop( &registers[EIP] );

 return 0;
}

int mov_rx_Iv( private_instruction_t * p )
{
	unsigned char op_code = p->op_code.octets[0];

	registers[ EAX + op_code - 0xb8 ] = p->imm.value;
 registers[EIP] += p->instruction_len;

	return 0;
}

int mov_Ev_Gv( private_instruction_t * p )
{
	if ( p->modrm.m.mod == 0x3 ) {
		registers[ p->modrm.m.rm + 1 ] = registers[ p->modrm.m.reg + 1 ];
  registers[EIP] += p->instruction_len;

		return 0;
	}

	ant_log(error, "Fatal error. Invalid instruction\n");
	exit( 1 );
}

int mov_Gv_Ev( private_instruction_t * p )
{
	if ( p->modrm.m.mod != 0x3 ) {
		unsigned int src_offset = 0;

		src_offset = registers[ p->modrm.m.rm + 1 ] + p->displacement.value;
		memcpy( &registers[ p->modrm.m.reg + 1 ], phy_memory + src_offset, 4 );

  registers[EIP] += p->instruction_len;

		return 0;
	}

	ant_log(error, "Fatal error. Invalid instruction\n");
	exit( 1 );
}

int grp11_mov_Ev_Iz( private_instruction_t * p )
{
	if ( p->modrm.m.reg == 0 ) {
		// sib addressing mode
		if ( p->modrm.m.rm == 0x4 ) {
			  unsigned int src = p->imm.value;
					unsigned int dst_offset = calculate_sib_offset( p );

					memcpy( phy_memory + dst_offset, &src, 4 );

				 registers[EIP] += p->instruction_len;

					return 0;
		}
	}

	ant_log(error, "Fatal error. Invalid instruction. %s\n", __FUNCTION__ );
 dump_instruction( -1, p->instruction_codes, p->instruction_len );

	exit( 1 );
}

int movzx_Gv_Eb( private_instruction_t * p )
{
	if ( p->modrm.m.mod != 0x3 ) {
		unsigned int src_offset = registers[ p->modrm.m.rm + 1 ];
		unsigned int dst = 0;

		memcpy( &dst, phy_memory + src_offset, 1 );
		registers[ p->modrm.m.reg + 1 ] = dst;
  registers[EIP] += p->instruction_len;

		return 0;
	}

	ant_log(error, "Fatal error. Invalid instruction\n");
	exit( 1 );
}

int movsx_Gv_Eb( private_instruction_t * p )
{
	if ( p->modrm.m.mod == 0x3 ) {
		char src = registers[ p->modrm.m.rm + 1 ];
		registers[ p->modrm.m.reg + 1 ] = src;
  registers[EIP] += p->instruction_len;

		return 0;
	}

	ant_log(error, "Fatal error. Invalid instruction\n");
	exit( 1 );
}

int push_op( private_instruction_t * p )
{
	push( registers[ EAX + p->op_code.octets[0] - 0x50 ] );
 registers[EIP] += p->instruction_len;

	return 0;
}

int pop_op( private_instruction_t * p )
{
 pop( &registers[ EAX + p->op_code.octets[0] - 0x58 ] );
 registers[EIP] += p->instruction_len;

 return 0;
}

int sub_op( private_instruction_t * p )
{
	int src1 = 0;
	int src2 = 0;
	int res = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
		res = src1 - src2;
		registers[p->modrm.m.rm + 1] = res;

		set_efl_cc( (unsigned int)src1 < (unsigned int)src2, EFL_CF );
		set_efl_cc( parity_table[(unsigned char)res], EFL_PF );
		set_efl_cc( (res ^ src1 ^ src2) & EFL_AF, EFL_AF );
		set_efl_cc( (res == 0), EFL_ZF );
		set_efl_cc( res >> 24 & EFL_SF, EFL_SF );
		set_efl_cc( ((src1 ^ src2) & (src1 ^ res)) >> 20 & EFL_OF, EFL_OF );

  registers[EIP] += p->instruction_len;

		return 0;
	}

	ant_log(error, "Fatal error. Unsupported now\n");
	exit( 1 );
}

int out_op( private_instruction_t * p )
{
	port_write( registers[EDX], registers[EAX] & 0xff );
 registers[EIP] += p->instruction_len;

 return 0;
}

int inst_2b_op( private_instruction_t * p )
{
	instruction_oper_ftype p_op = op_array_2bytes[ p->op_code.octets[1] ];

	if ( p_op ) {
		p_op( p );
		return 0;
	}
	
	ant_log( error, "Fatal error, can't find instruction call back function\n" );
	exit( 1 );
}

int grp1_op( private_instruction_t * p )
{
	if ( grp1_op_array[p->modrm.m.reg] ) {
		grp1_op_array[p->modrm.m.reg]( p );
	}

	return 0;
}

int test_op( private_instruction_t * p )
{
	unsigned int src1 = 0;
	unsigned int src2 = 0;
	unsigned int res = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[ p->modrm.m.reg + 1 ];
		src2 = registers[ p->modrm.m.rm + 1 ];
		res = src1 & src2;

		set_efl_cc( 0, EFL_CF );
		set_efl_cc( parity_table[(unsigned char)res], EFL_PF );
		set_efl_cc( (res == 0) * EFL_ZF, EFL_ZF );
		set_efl_cc( res & EFL_SF, EFL_SF );
		set_efl_cc( 0, EFL_OF );

  registers[EIP] += p->instruction_len;

		return 0;
	}
	
	ant_log(error, "Fatal error. Unsupported operation\n");
	exit( 1 );
}

int _jcc_op( int cc, private_instruction_t * p )
{
 registers[EIP] += p->instruction_len;

	if ( cc ) {
		registers[EIP] += (char)p->displacement.octets[0];
	}

	return 0;
}

int je( private_instruction_t * p )
{
	return _jcc_op( registers[EFL] & EFL_ZF , p );
}

int jne( private_instruction_t * p )
{
	return _jcc_op( !(registers[EFL] & EFL_ZF) , p );
}

int jb( private_instruction_t * p )
{
 registers[EIP] += p->instruction_len;
	registers[EIP] += (char)p->displacement.octets[0];
	return 0;
}

int add_op( private_instruction_t * p )
{
	int src1 = 0;
	int src2 = 0;
	int res = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
		res = src1 + src2;
		registers[p->modrm.m.rm + 1] = res;

		set_efl_cc( ((unsigned int)res < (unsigned int)src2) | ((unsigned int)res < (unsigned int)src1), EFL_CF );
		set_efl_cc( parity_table[(unsigned char)res], EFL_PF );
		set_efl_cc( (res ^ src1 ^ src2) & EFL_AF, EFL_AF );
		set_efl_cc( (res == 0) * EFL_ZF, EFL_ZF );
		set_efl_cc( res >> 24 & EFL_SF, EFL_SF );
		set_efl_cc( ( (~(src1 ^ src2)) & (src1 ^ res) ) >> 20 & EFL_OF, EFL_OF );

  registers[EIP] += p->instruction_len;

		return 0;
	}
	
	ant_log(error, "Fatal error. Unsupported now\n");
	exit( 1 );
}

int cmp_op( private_instruction_t * p )
{
	int src1 = 0;
	int src2 = 0;
	int res = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
		res = src1 - src2;

		set_efl_cc( (unsigned int)src1 < (unsigned int)src2, EFL_CF );
		set_efl_cc( parity_table[(unsigned char)res], EFL_PF );
		set_efl_cc( (res ^ src1 ^ src2) & EFL_AF, EFL_AF );
		set_efl_cc( (res == 0) * EFL_ZF, EFL_ZF );
		set_efl_cc( res >> 24 & EFL_SF, EFL_SF );
		set_efl_cc( ((src1 ^ src2) & (src1 ^ res)) >> 20 & EFL_OF, EFL_OF );

	 registers[EIP] += p->instruction_len;

		return 0;
	}
	
	ant_log(error, "Fatal error. Unsupported now\n");
	exit( 1 );
}

/****************************************************/
/* Part5 Instruction decode function implementation */
/****************************************************/

void _decode_op( private_instruction_t * p )
{
	p->op_code.octets[p->op_code_len] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->instruction_codes[ p->instruction_len ] = p->op_code.octets[p->op_code_len];
	p->op_code_len += 1;
	p->instruction_len += 1;
}

void __decode_dis( private_instruction_t * p, int len )
{
	int i = 0;

	for ( ; i<len; ++i ) {
		p->displacement.octets[i] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
		p->displacement_len++;

		p->instruction_codes[ p->instruction_len ] = p->displacement.octets[i];
		p->instruction_len++;
	}
}

void _decode_d32( private_instruction_t * p )
{
	__decode_dis( p, 4 );
}

void _decode_d8( private_instruction_t * p )
{
	__decode_dis( p, 1 );
}

// _decode_d depends on modrm parameter, only the instruction has modrm
// it can call _decode_d
void _decode_d( private_instruction_t * p )
{
	if ( p->modrm.value != 0 ) {
		if ( p->modrm.m.rm == 0x4 ) {
			if ( p->modrm.m.mod == 0 ) {
				return;
			} else if( p->modrm.m.mod == 1 ) {
				_decode_d8( p );
				return;
			} else if ( p->modrm.m.mod == 2 ) {
				_decode_d32( p );
				return;
			}
  }
	}

 ant_log( error, "Fatal error, unknown mod value in %s\n", __FUNCTION__ );
 dump_instruction( -1, p->instruction_codes, p->instruction_len );
 exit( 1 );
}

void _decode_imm( private_instruction_t * p, int len )
{
	int i = 0;

	for ( ; i<len; ++i ) {
		p->imm.octets[i] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
		p->imm_len++;

		p->instruction_codes[ p->instruction_len ] = p->imm.octets[i];
		p->instruction_len++;
	}
}

void _decode_i32( private_instruction_t * p )
{
	_decode_imm( p, 4 );
}

void _decode_i8( private_instruction_t * p )
{
	_decode_imm( p, 1 );
}

void _decode_m( private_instruction_t * p )
{
	p->modrm.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->instruction_codes[ p->instruction_len ] = p->modrm.value;
	p->instruction_len += 1;
}

void _decode_s( private_instruction_t * p )
{
	p->sib.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->instruction_codes[ p->instruction_len ] = p->sib.value;
	p->instruction_len += 1;
}

void d1o( private_instruction_t * p )
{
	_decode_op( p );
}

void d2od32( private_instruction_t * p )
{
	_decode_op( p );
	_decode_d32( p );
}

void d2od8( private_instruction_t * p )
{
	_decode_op( p );
	_decode_d8( p );
}

void d2oi32( private_instruction_t * p )
{
	_decode_op( p );
	_decode_i32( p );
}

void d2om( private_instruction_t * p )
{
	_decode_op( p );
	_decode_m( p );
}

void d3omi8( private_instruction_t * p )
{
	_decode_op( p );
	_decode_m( p );
	_decode_i8( p );
}

void d3omd( private_instruction_t * p )
{
	_decode_op( p );
	_decode_m( p );
	_decode_d( p );
}

void d5omsdi32( private_instruction_t * p )
{
	_decode_op( p );
	_decode_m( p );
	_decode_s( p );

 if ( p->modrm.m.rm == 0x4 ) {
	 _decode_d( p );
	}

	_decode_i32( p );
}

void d_inst2( private_instruction_t * p )
{
	unsigned char instruction_octet = 0;
	instruction_decode_ftype p_decode_f = NULL;

	_decode_op( p );

	instruction_octet = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p_decode_f = decode_array_2bytes[ instruction_octet ];

	if ( p_decode_f ) {
		p_decode_f( p );
	} else {
		ant_log( error, "Fatal error, unknown instruction\n" );
		dump_instruction( -1, p->instruction_codes, p->instruction_len );
		exit( 1 );
	}
}

/*************************************************/
/* Part6 Instruction class method implementation */
/*************************************************/

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
	instruction_decode_ftype p_decode_f = decode_array_1byte[ instruction_octet ];

	if ( p_decode_f ) {
		p_decode_f( p_inst->priv );
	} else {
		ant_log( error, "Fatal error, unknown instruction, opcode = 0x%02x\n", instruction_octet );
		exit( 1 );
	}
}

void instruction_run( instruction_t * p_inst )
{
	static int instruction_counter = 0;
	private_instruction_t * p = p_inst->priv;
	instruction_oper_ftype p_op = op_array_1byte[ p->op_code.octets[0] ];

	if ( p_op ) {
		p_op( p );
	} else {
		ant_log( error, "Fatal error, can't find instruction call back function\n" );
		exit( 1 );
	}

	dump_instruction( ++instruction_counter, p->instruction_codes, p->instruction_len );
	dump_registers();
}
