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
	char instruction_len;
} private_instruction_t;

/***************************************/
/* Instruction operation functions map */
/***************************************/

int sub_op( instruction_t * p_inst );
int call_op( instruction_t * p_inst );
int move_op( instruction_t * p_inst );
int push_op( instruction_t * p_inst );
int grp1_op( instruction_t * p_inst );
int inst_2b_op( instruction_t * p_inst );
int test_op( instruction_t * p_inst );
int jcc_op( instruction_t * p_inst );
int jmp_op( instruction_t * p_inst );
int add_op( instruction_t * p_inst );
int cmp_op( instruction_t * p_inst );

typedef int (*instruction_oper_ftype)( instruction_t * p_inst );

instruction_oper_ftype op_array_2bytes[256] = {
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		move_op,0,		0,		0,		0,		0,		0,		0,		move_op,0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
};

instruction_oper_ftype op_array_1byte[256] = {
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		inst_2b_op,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
push_op,push_op,push_op,push_op,push_op,push_op,push_op,push_op,0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		jcc_op,	0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		grp1_op,test_op,0,		0,		0,		0,		move_op,0,		move_op,0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		move_op,move_op,move_op,move_op,move_op,move_op,move_op,move_op,
0,		0,		0,		0,		0,		0,		0,		move_op,0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		call_op,0,		0,		jmp_op,	0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,		0,
};

/***************************************/
/* Group 1 operation functions map     */
/***************************************/

instruction_oper_ftype grp1_op_array[8] = {
add_op,	0,		0,		0,		0,	sub_op,		0,		cmp_op
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
/* d1o    = decode 1 element, element  */
/* is operation code                   */
/* d3omi8 = decode 3 elements,         */
/* elements are operation code, modrm  */
/* and byte immediate                  */
/***************************************/

void d1o( instruction_t * p_inst );
void d2od8( instruction_t * p_inst );
void d2od32( instruction_t * p_inst );
void d2oi32( instruction_t * p_inst );
void d2om( instruction_t * p_inst );
void d3omi8( instruction_t * p_inst );
void d3omd8( instruction_t * p_inst );
void d3omsi32( instruction_t * p_inst );
void d_inst2( instruction_t * p_inst ); //decode 2 bytes instruction

typedef void (*instruction_decode_ftype)( instruction_t * p_inst );

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
d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,	d1o,		0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		d2od8,	0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		d3omi8,	d2om,	0,		0,		0,			0,		d2om,	0,		d3omd8,	0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,	d2oi32,
0,		0,		0,		0,		0,		0,		0,		d3omsi32,	0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			d2od32,	0,		0,		d2od8,	0,		0,		0,		0,
0,		0,		0,		0,		0,		0,		0,		0,			0,		0,		0,		0,		0,		0,		0,		0,
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
	unsigned char op_code = p->op_code.octets[0];
	unsigned char op_code1 = 0;

	switch ( op_code )
	{
	case 0xb8:
	case 0xb9:
	case 0xba:
	case 0xbb:
	case 0xbc:
	case 0xbd:
	case 0xbe:
	case 0xbf:
		{
			registers[ EAX + op_code - 0xb8 ] = p->imm.value;
			break;
		}
	case 0x89:
		{
			if ( p->modrm.m.mod == 0x3 ) {
				registers[ p->modrm.m.rm + 1 ] = registers[ p->modrm.m.reg + 1 ];
			} else {
				printf("Fatal error. Unsupported operation\n");
				exit( 1 );
			}
			break;
		}
	case 0x8b:
		{
			if ( p->modrm.m.mod != 0x3 ) {
				unsigned int src_offset = 0;
				
				src_offset = registers[ p->modrm.m.rm + 1 ] + p->displacement.value;
				memcpy( &registers[ p->modrm.m.reg + 1 ], phy_memory + src_offset, 4 );
			} else {
				printf("Fatal error. Unsupported operation\n");
				exit( 1 );
			}
			break;
		}
	case 0x0f:
		{
			op_code1 = p->op_code.octets[1];

			switch ( op_code1 )
			{
			case 0xb6:
				{
					if ( p->modrm.m.mod != 0x3 ) {
						unsigned int src_offset = registers[ p->modrm.m.rm + 1 ];
						unsigned int dst = 0;

						memcpy( &dst, phy_memory + src_offset, 1 );
						registers[ p->modrm.m.reg + 1 ] = dst;
					} else {
						printf("Fatal error. Unsupported operation\n");
						exit( 1 );
					}
					break;
				}
			case 0xbe:
				{
					if ( p->modrm.m.mod == 0x3 ) {
						char src = registers[ p->modrm.m.rm + 1 ];
						registers[ p->modrm.m.reg + 1 ] = src;
					} else {
						printf("Fatal error. Unsupported operation\n");
						exit( 1 );
					}
					break;
				}
			default:
				break;
			}
			
			break;
		}
	case 0xc7:
		{
			if ( p->modrm.m.reg != 0 ) {
				printf("Fatal error. Grp 11's reg can't be non-zero\n");
				exit( 1 );
			}

			if ( p->modrm.m.mod == 0 ) {
				unsigned int src = p->imm.value;
				unsigned int dst_offset = 0;
				
				if ( p->modrm.m.rm != 0x4 ) {
					printf("Fatal error. Grp 11's reg can't be non-zero\n");
					exit( 1 );
				} else {
					if ( p->sib.s.scale == 0 && p->sib.s.index == 4 ) {
						if ( p->sib.s.base == 5 ) {
							printf("Fatal error. Invalid instruction\n");
							exit( 1 );
						} else {
							dst_offset = registers[p->sib.s.base + 1];
						}
					} else {
						printf("Fatal error. Invalid instruction\n");
						exit( 1 );
					}
				}

				memcpy( phy_memory + dst_offset, &src, 4 );
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

int push_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	if ( p->op_code.octets[0] < 0x50 || p->op_code.octets[0] > 0x57 ) {
		printf("Fatal error. Unsupported now\n");
		exit( 1 );
	}

	push( registers[ EAX + p->op_code.octets[0] - 0x50 ] );

	return 0;
}

int sub_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	int src1 = 0;
	int src2 = 0;
	int res = 0;
    int cf = 0;
	int pf = 0;
	int af = 0;
	int zf = 0;
	int sf = 0;
	int of = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
	} else {
		printf("Fatal error. Unsupported now\n");
		exit( 1 );
	}
	
	res = src1 - src2;
	registers[p->modrm.m.rm + 1] = res;

    cf = (unsigned int)src1 < (unsigned int)src2;
    pf = parity_table[(unsigned char)res];
    af = (res ^ src1 ^ src2) & EFL_AF;
    zf = (res == 0) * EFL_ZF;
    sf = res >> 24 & EFL_SF;
    of = ((src1 ^ src2) & (src1 ^ res)) >> 20 & EFL_OF;

    registers[EFL] &= ~( EFL_CF | EFL_PF | EFL_AF | EFL_ZF | EFL_SF | EFL_OF );
    registers[EFL] |= ( cf | pf | af | zf | sf | of );

	return 0;
}

int inst_2b_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	instruction_oper_ftype p_op = op_array_2bytes[ p->op_code.octets[1] ];

	if ( p_op ) {
		p_op( p_inst );
	} else {
		printf( "Fatal error, can't find instruction call back function\n" );
		exit( 1 );
	}

	return 0;
}

int grp1_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	switch ( p->op_code.octets[0] )
	{
	case 0x83:
		{
			if ( grp1_op_array[p->modrm.m.reg] ) {
				grp1_op_array[p->modrm.m.reg]( p_inst );
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

int test_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	unsigned int src1 = 0;
	unsigned int src2 = 0;
	unsigned int tmp = 0;
	int of = 0;
    int cf = 0;
	int sf = 0;
	int zf = 0;
	int pf = 0;
	unsigned char op_code = p->op_code.octets[ 0 ];

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[ p->modrm.m.reg + 1 ];
		src2 = registers[ p->modrm.m.rm + 1 ];
		tmp = src1 & src2;
	} else {
		printf("Fatal error. Unsupported operation\n");
		exit( 1 );
	}

    cf = 0;
    pf = parity_table[(unsigned char)tmp];
    zf = (tmp == 0) * EFL_ZF;
	sf = tmp >> ( op_code == 0x84 ? 0 : 24 ) & EFL_SF;
    of = 0;

    registers[EFL] &= ~( EFL_CF | EFL_PF | EFL_ZF | EFL_SF | EFL_OF );
    registers[EFL] |= ( cf | pf | zf | sf | of );

	return 0;
}

int jcc_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	unsigned char op_code = p->op_code.octets[0];
	
	if ( op_code == 0x74 ) {
		if ( registers[EFL] & EFL_ZF ) {
			registers[EIP] += p->displacement.value;
		}
	} else if ( op_code == 0x75 ) {
		if ( !(registers[EFL] & EFL_ZF) ) {
			registers[EIP] += p->displacement.value;
		}
	} else {
		printf("Fatal error. Unsupported operation\n");
		exit( 1 );
	}

	return 0;
}

int jmp_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	unsigned char op_code = p->op_code.octets[0];

	if ( op_code == 0xeb ) {
		registers[EIP] += p->displacement.value;
	} else {
		printf("Fatal error. Unsupported operation\n");
		exit( 1 );
	}

	return 0;
}

int add_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	int src1 = 0;
	int src2 = 0;
	int res = 0;
    int cf = 0;
	int pf = 0;
	int af = 0;
	int zf = 0;
	int sf = 0;
	int of = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
	} else {
		printf("Fatal error. Unsupported now\n");
		exit( 1 );
	}

	res = src1 + src2;
	registers[p->modrm.m.rm + 1] = res;

    cf = (unsigned int)res < (unsigned int)src2 | (unsigned int)res < (unsigned int)src1;
    pf = parity_table[(unsigned char)res];
    af = (res ^ src1 ^ src2) & EFL_AF;
    zf = (res == 0) * EFL_ZF;
    sf = res >> 24 & EFL_SF;
    of = ( (~(src1 ^ src2)) & (src1 ^ res) ) >> 20 & EFL_OF;

    registers[EFL] &= ~( EFL_CF | EFL_PF | EFL_AF | EFL_ZF | EFL_SF | EFL_OF );
    registers[EFL] |= ( cf | pf | af | zf | sf | of );

	return 0;
}

int cmp_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;
	int src1 = 0;
	int src2 = 0;
	int res = 0;
    int cf = 0;
	int pf = 0;
	int af = 0;
	int zf = 0;
	int sf = 0;
	int of = 0;

	if ( p->modrm.m.mod == 0x3 ) {
		src1 = registers[p->modrm.m.rm + 1];
		src2 = p->imm.octets[0];
	} else {
		printf("Fatal error. Unsupported now\n");
		exit( 1 );
	}

	res = src1 - src2;

    cf = (unsigned int)src1 < (unsigned int)src2;
    pf = parity_table[(unsigned char)res];
    af = (res ^ src1 ^ src2) & EFL_AF;
    zf = (res == 0) * EFL_ZF;
    sf = res >> 24 & EFL_SF;
    of = ((src1 ^ src2) & (src1 ^ res)) >> 20 & EFL_OF;

    registers[EFL] &= ~( EFL_CF | EFL_PF | EFL_AF | EFL_ZF | EFL_SF | EFL_OF );
    registers[EFL] |= ( cf | pf | af | zf | sf | of );

	return 0;
}

/*****************************************/
/* Instruction decode function implement */
/*****************************************/

void _decode_op( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->op_code.octets[p->op_code_len] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p->instruction_codes[ p->instruction_len ] = p->op_code.octets[p->op_code_len];

	p->op_code_len += 1;
	p->instruction_len += 1;
}

void __decode_dis( instruction_t * p_inst, int len )
{
	private_instruction_t * p = p_inst->priv;
	int i = 0;

	for ( ; i<len; ++i ) {
		p->displacement.octets[i] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
		p->displacement_len++;

		p->instruction_codes[ p->instruction_len ] = p->displacement.octets[i];
		p->instruction_len++;
	}
}

void _decode_d32( instruction_t * p_inst )
{
	__decode_dis( p_inst, 4 );
}

void _decode_d8( instruction_t * p_inst )
{
	__decode_dis( p_inst, 1 );
}

void _decode_imm( instruction_t * p_inst, int len )
{
	private_instruction_t * p = p_inst->priv;
	int i = 0;

	for ( ; i<len; ++i ) {
		p->imm.octets[i] = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
		p->imm_len++;

		p->instruction_codes[ p->instruction_len ] = p->imm.octets[i];
		p->instruction_len++;
	}
}

void _decode_i32( instruction_t * p_inst )
{
	_decode_imm( p_inst, 4 );
}

void _decode_i8( instruction_t * p_inst )
{
	_decode_imm( p_inst, 1 );
}

void _decode_m( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->modrm.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );

	p->instruction_codes[ p->instruction_len ] = p->modrm.value;
	p->instruction_len += 1;
}

void _decode_s( instruction_t * p_inst )
{
	private_instruction_t * p = p_inst->priv;

	p->sib.value = fetch_char( phy_memory, registers[EIP] + p->instruction_len );

	p->instruction_codes[ p->instruction_len ] = p->sib.value;
	p->instruction_len += 1;
}

void d1o( instruction_t * p_inst )
{
	_decode_op( p_inst );
}

void d2od32( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_d32( p_inst );
}

void d2od8( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_d8( p_inst );
}

void d2oi32( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_i32( p_inst );
}

void d2om( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
}

void d3omi8( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
	_decode_i8( p_inst );
}

void d3omd8( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
	_decode_d8( p_inst );
}

void d3omsi32( instruction_t * p_inst )
{
	_decode_op( p_inst );
	_decode_m( p_inst );
	_decode_s( p_inst );
	_decode_i32( p_inst );
}

void d_inst2( instruction_t * p_inst )
{
	unsigned char instruction_octet = 0;
	instruction_decode_ftype p_decode_f = NULL;
	private_instruction_t * p = p_inst->priv;

	_decode_op( p_inst );

	instruction_octet = fetch_char( phy_memory, registers[EIP] + p->instruction_len );
	p_decode_f = decode_array_2bytes[ instruction_octet ];

	if ( p_decode_f ) {
		p_decode_f( p_inst );
	} else {
		printf( "Fatal error, unknown instruction\n" );
		exit( 1 );
	}
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
	instruction_decode_ftype p_decode_f = decode_array_1byte[ instruction_octet ];

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
	instruction_oper_ftype p_op = op_array_1byte[ p->op_code.octets[0] ];

	if ( p_op ) {
		p_op( p_inst );
	} else {
		printf( "Fatal error, can't find instruction call back function\n" );
		exit( 1 );
	}

	registers[EIP] += p->instruction_len;

	dump_instruction( ++instruction_counter, p->instruction_codes, p->instruction_len );
	dump_registers();
}
