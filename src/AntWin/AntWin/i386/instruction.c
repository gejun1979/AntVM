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
/* 1. Instruction data structure definition;         */
/* 2. Instruction operation function map;            */
/* 3. Instruction decode function map;               */
/* 4. Instruction operation function implementation; */
/* 5. Instruction decode function implementation;    */
/* 6. Instruction class implementation.              */
/*****************************************************/

/****************************************************/
/* Part1: Instruction data structure definition     */
/****************************************************/

#define MAX_PARAMETERS 5
#define calculate_parameter_from_Eb calculate_parameter_from_Ev
#define calculate_index_from_Gb     calculate_index_from_Gv
#define calculate_parameter_from_Jb (unsigned char)calculate_parameter_from_Jz
#define calculate_parameter_from_Ib (unsigned char)calculate_parameter_from_Iv
#define stype_from_Eb stype_from_Ev

typedef enum _storage_type_t {
    mem = 0,
    reg = 1,
    imm = 2,
    oth = 3
} storage_type;

typedef enum _operand_size_t {
    operand_32 = 4,
    operand_16 = 2,
    operand_8 = 1
} operand_size;

typedef struct _operand_wrapper_t {
    storage_type storage;
    operand_size size;
    union {
        char * p;
        unsigned int v;
    } value;
} operand_wrapper_t;

void operand_wrapper_init( operand_wrapper_t * p_wrapper, storage_type storage, operand_size size, unsigned int value )
{
    p_wrapper->storage = storage;
    p_wrapper->size = size;
    p_wrapper->value.v = value;
}

void operand_wrapper_set_value( operand_wrapper_t * p_wrapper, unsigned int value )
{
    if ( p_wrapper->storage == reg ) {
        set_register_value( p_wrapper->value.v, value );
    } else if ( p_wrapper->storage == mem ){
        memcpy( (char *)p_wrapper->value.p, &value, p_wrapper->size );
    } else {
        p_wrapper->value.v = value;
    }
}

unsigned int operand_wrapper_get_value( operand_wrapper_t * p_wrapper )
{
    if ( p_wrapper->storage == reg ) {
        return get_register_value( p_wrapper->value.v );
    } else if ( p_wrapper->storage == mem ){
        unsigned int result = 0;
        memcpy( &result, p_wrapper->value.p, p_wrapper->size );
        return result;
    } else {
        return p_wrapper->value.v;
    }

    return 0;
}

#define U8( para ) ((unsigned char)( operand_wrapper_get_value(&para) & 0xff ))
#define I8( para ) ((char)( operand_wrapper_get_value(&para) & 0xff ))
#define U16( para ) ((unsigned short)( operand_wrapper_get_value(&para) & 0xffff ))
#define I16( para ) ((short)( operand_wrapper_get_value(&para) & 0xffff ))
#define U32( para ) ( operand_wrapper_get_value(&para) )
#define I32( para ) ( (int)operand_wrapper_get_value(&para) )

#define MSB( para, oprand_size ) ( para & (1 << ((int)8*oprand_size - 1)) )
#define LSB( para ) ( para & 1 )

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

    operand_wrapper_t parameters[MAX_PARAMETERS];
    int parameters_num; //valid parameters number

    char * p_result;
    int result_len;
} private_instruction_t;

/********************************************/
/* Part2 Instruction operation function map */
/********************************************/

int add_op( operand_wrapper_t * ops, int num, int instruction_len );
int sub_op( operand_wrapper_t * ops, int num, int instruction_len );
int cmp_op( operand_wrapper_t * ops, int num, int instruction_len );
int test_op( operand_wrapper_t * ops, int num, int instruction_len );
int je_op( operand_wrapper_t * ops, int num, int instruction_len );
int jne_op( operand_wrapper_t * ops, int num, int instruction_len );
int jb_op( operand_wrapper_t * ops, int num, int instruction_len );
int call_op( operand_wrapper_t * ops, int num, int instruction_len );
int ret_op( operand_wrapper_t * ops, int num, int instruction_len );
int mov_RI_op( operand_wrapper_t * ops, int num, int instruction_len );
int mov_op( operand_wrapper_t * ops, int num, int instruction_len );
int xor_EG_op( operand_wrapper_t * ops, int num, int instruction_len );
int movsx_op( operand_wrapper_t * ops, int num, int instruction_len );
int movzx_op( operand_wrapper_t * ops, int num, int instruction_len );
int push_op( operand_wrapper_t * ops, int num, int instruction_len );
int pop_op( operand_wrapper_t * ops, int num, int instruction_len );
int grp1_op( operand_wrapper_t * ops, int num, int instruction_len );
int inst_2b_op( operand_wrapper_t * ops, int num, int instruction_len );
int out_op( operand_wrapper_t * ops, int num, int instruction_len );
int lea_op(operand_wrapper_t * ops, int num, int instruction_len);

typedef int (*instruction_oper_ftype)( operand_wrapper_t * ops, int num, int instruction_len );

instruction_oper_ftype op_array_2bytes[256] = {
    /*00       01       02       03       04       05       06        07        08        09        0A        0B        0C        0D        0E        0F*/
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*01*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*02*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*03*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*04*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*05*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*06*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*07*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*08*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*09*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0A*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0B*/0,       0,       0,       0,       0,       0,       movzx_op, 0,        0,        0,        0,        0,        0,        0,        movsx_op, 0,
/*0C*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0D*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0E*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0F*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
};

instruction_oper_ftype op_array_1byte[256] = {
    /*00       01       02       03       04       05       06        07        08        09        0A        0B        0C        0D        0E        0F*/
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        inst_2b_op,
/*01*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*02*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*03*/0,       xor_EG_op,0,      0,       0,       0,       0,        0,        cmp_op,   cmp_op,   0,        0,        0,        0,        0,        0,
/*04*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*05*/push_op, push_op, push_op, push_op, push_op, push_op, push_op,  push_op,  pop_op,   pop_op,   pop_op,   pop_op,   pop_op,   pop_op,   pop_op,   pop_op,
/*06*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*07*/0,       0,       0,       0,       je_op,   jne_op,  0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*08*/0,       0,       0,       grp1_op, test_op, test_op, 0,        0,        mov_op,   mov_op,   0,        mov_op,   0,        lea_op,   0,        0,
/*09*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0A*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0B*/0,       0,       0,       0,       0,       0,       0,        0,        mov_RI_op,mov_RI_op,mov_RI_op,mov_RI_op,mov_RI_op,mov_RI_op,mov_RI_op,mov_RI_op,
/*0C*/0,       0,       0,       ret_op,  0,       0,       0,        mov_op,   0,        0,        0,        0,        0,        0,        0,        0,
/*0D*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0E*/0,       0,       0,       0,       0,       0,       0,        0,        call_op,  0,        0,        jb_op,    0,        0,        out_op,   0,
/*0F*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
};

/***************************************/
/* Group 1 operation functions map     */
/***************************************/

instruction_oper_ftype grp1_op_array[8] = {
    /*00       01       02       03       04       05       06        07*/
      add_op,  0,       0,       0,       0,       sub_op,  0,        cmp_op
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
/* d4omsi8 = decode 3 elements,        */
/* elements are operation code, modrm  */
/* and byte immediate                  */
/***************************************/

void mov_RI_d( private_instruction_t * p );
void g11_mov_d( private_instruction_t * p );
void movzx_d( private_instruction_t * p );
void movsx_d( private_instruction_t * p );
void simple_d( private_instruction_t * p );
void inst2_d( private_instruction_t * p );
void jb_d( private_instruction_t * p );
void call_d(private_instruction_t * p);
void d_Ev_Gv(private_instruction_t * p);
void d_Eb_Gb(private_instruction_t * p);
void d_Gv_Ev(private_instruction_t * p);
void d_Gv_M( private_instruction_t * p );
void d_Ev_Ib(private_instruction_t * p);

typedef void (*decode_ftype)( private_instruction_t * p );

decode_ftype decode_array_2bytes[256] = {
    /*00       01       02       03       04       05       06        07        08        09        0A        0B        0C        0D        0E        0F*/
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       movzx_d,  0,        0,        0,        0,        0,        0,        0,        movsx_d,  0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*00*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
};

decode_ftype decode_array_1byte[256] = {
    /*00       01       02       03       04       05       06        07        08        09        0A        0B        0C        0D        0E        0F*/
/*00*/d_Eb_Gb, d_Ev_Gv, 0,       0,       0,       0,       0,        0,        d_Eb_Gb,  d_Ev_Gv,  0,        0,        0,        0,        0,        inst2_d,
/*01*/d_Eb_Gb, d_Ev_Gv, 0,       0,       0,       0,       0,        0,        d_Eb_Gb,  d_Ev_Gv,  0,        0,        0,        0,        0,        0,
/*02*/d_Eb_Gb, d_Ev_Gv, 0,       0,       0,       0,       0,        0,        d_Eb_Gb,  d_Ev_Gv,  0,        0,        0,        0,        0,        0,
/*03*/d_Eb_Gb, d_Ev_Gv, 0,       0,       0,       0,       0,        0,        d_Eb_Gb,  d_Ev_Gv,  0,        0,        0,        0,        0,        0,
/*04*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*05*/simple_d,simple_d,simple_d,simple_d,simple_d,simple_d,simple_d, simple_d, simple_d, simple_d, simple_d, simple_d, simple_d, simple_d, simple_d, simple_d,
/*06*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*07*/0,       0,       0,       0,       jb_d,    jb_d,    0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*08*/d_Eb_Gb, 0,       0,       d_Ev_Ib,  d_Eb_Gb, d_Ev_Gv,0,        0,        d_Eb_Gb,  d_Ev_Gv,  0,        d_Gv_Ev,  0,        d_Gv_M,   0,        0,
/*09*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0A*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0B*/0,       0,       0,       0,       0,       0,       0,        0,        mov_RI_d, mov_RI_d, mov_RI_d, mov_RI_d, mov_RI_d, mov_RI_d, mov_RI_d, mov_RI_d,
/*0C*/0,       d_Ev_Ib, 0,       simple_d,0,       0,       0,        g11_mov_d,0,        0,        0,        0,        0,        0,        0,        0,
/*0D*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
/*0E*/0,       0,       0,       0,       0,       0,       0,        0,        call_d,   0,        0,        jb_d,     0,        0,        simple_d, 0,
/*0F*/0,       0,       0,       0,       0,       0,       0,        0,        0,        0,        0,        0,        0,        0,        0,        0,
};

/*******************************************************/
/* Part4 Instruction operation function implementation */
/*******************************************************/

// Some instructions needn't update EIP register with instruction length,
// so just skip them.
int is_skip_ip( instruction_oper_ftype p_func )
{
    if ( p_func == call_op || p_func == ret_op ) {
        return 1;
    }

    return 0;
}

void push( int value )
{
	set_register_value( ESP, get_register_value(ESP) - 4 );

    if ( get_register_value(ESP) < MEMORY_SIZE ) {
        *((int *) (phy_memory + get_register_value(ESP))) = value;
        return;
    }

    ant_log(error, "Fatal error, memory overflow\n");
    exception_exit(1);
}

void pop( int * p_value )
{
    *p_value = *((int *) (phy_memory + get_register_value(ESP)));
	set_register_value( ESP, get_register_value(ESP) + 4 );
}

int call_op( operand_wrapper_t * ops, int num, int instruction_len )
{
	int value = get_register_value( EIP );

	value += instruction_len;

    push( value );

    value += U32(ops[0]);

	set_register_value( EIP, value );

    return 0;
}

int ret_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    int offset = 0;

    pop( &offset );
    set_register_value( EIP, offset );

    return 0;
}

int mov_RI_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    set_register_value( EAX + U8(ops[0]) - 0xb8, U32(ops[1]) );

    return 0;
}

int xor_EG_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    unsigned int res = U32(ops[0]) ^ U32(ops[1]);
    operand_wrapper_set_value( &ops[0], res );

    return 0;
}

int mov_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    operand_wrapper_set_value( &ops[0], U32(ops[1]) );

    return 0;
}

int movzx_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    unsigned int res = U8(ops[1]);
    operand_wrapper_set_value( &ops[0], res );

    return 0;
}

int movsx_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    int res = (char) U8(ops[1]);
    operand_wrapper_set_value( &ops[0], res );

    return 0;
}

int push_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    push( get_register_value( EAX + U8(ops[0]) - 0x50 ) );

    return 0;
}

int pop_op( operand_wrapper_t * ops, int num, int instruction_len )
{
	int value = 0;

    pop( &value );

	set_register_value( EAX + U8(ops[0]) - 0x58, value );

    return 0;
}

int sub_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    unsigned int res = U32(ops[0]) - U32(ops[1]);
    operand_wrapper_set_value( &ops[0], res );

    set_efl_cc( U32(ops[0]) < U32(ops[1]), EFL_CF );
    set_efl_cc( parity_table[res&0xff], EFL_PF );
    set_efl_cc( (res ^ U32(ops[0]) ^ U32(ops[1])) & EFL_AF, EFL_AF );
    set_efl_cc( (res == 0), EFL_ZF );
    set_efl_cc( res >> 24 & EFL_SF, EFL_SF );
    set_efl_cc( ((U32(ops[0]) ^ U32(ops[1])) & (U32(ops[0]) ^ res)) >> 20 & EFL_OF, EFL_OF );

    return 0;
}

int out_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    port_write( get_register_value(EDX) & 0xffff, get_register_value(EAX) & 0xff );

    return 0;
}

int inst_2b_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    instruction_oper_ftype p_op = op_array_2bytes[ U8(ops[ num - 1 ]) ];

    if ( p_op ) {
        p_op( ops, num - 1, instruction_len );
        return 0;
    }

    ant_log( error, "Fatal error, can't find instruction call back function\n" );
    exception_exit( 1 );

	return 0;
}

int grp1_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    if ( 3 == num ) {
        instruction_oper_ftype p_op = grp1_op_array[U32(ops[2])];

        if ( p_op ) {
            p_op( ops, 2, instruction_len );
            return 0;
        }
    }

    ant_log( error, "Fatal error, unknown command, %s\n", __FUNCTION__ );
    exception_exit( 1 );

	return 0;
}

int rol_op( operand_wrapper_t * ops, int num, int instruction_len )
{
	if (num != 2) {
		ant_log(error, "Fatal error, invalid op num, %d\n", num);
		return -1;
	}

	int TemporaryCount = 0;
	switch(ops[1].size) {
		case operand_8:
			TemporaryCount = operand_wrapper_get_value(&ops[1]) % 8;
			break;
		case operand_16:
			TemporaryCount = operand_wrapper_get_value(&ops[1]) % 16;
			break;
		case operand_32:
			TemporaryCount = operand_wrapper_get_value(&ops[1]) % 32;
			break;
		default:
			ant_log(error, "Fatal error, invalid op size, %d\n", (int)ops[1].size);
			return -1;
	}

	int TemporaryCF = 0;
	int Count = operand_wrapper_get_value(&ops[0]);
	int Destination = Count;
	while(TemporaryCount != 0) {
		TemporaryCF = MSB(Destination, ops[0].size);
		Destination = (Destination << 1) + TemporaryCF;
		TemporaryCount = TemporaryCount - 1;
	}
	
	int CF = LSB(Destination);
	int OF = 0;
	if (Count == 1) {
		OF = MSB(Destination, ops[1].size) ^ CF;
	}

	set_efl_cc(CF, EFL_CF);
	set_efl_cc(OF, EFL_OF);

	return 0;
}

int test_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    unsigned int res = 0;
    unsigned int max_operand_size = max( ops[0].size, ops[1].size );

    if ( max_operand_size == operand_8 ) {
        res = U8(ops[0]) & U8(ops[1]);
    } else if ( max_operand_size == operand_16 ) {
        res = U16(ops[0]) & U16(ops[1]);
    } else {
        res = U32(ops[0]) & U32(ops[1]);
    }

    set_efl_cc( 0, EFL_CF );
    set_efl_cc( parity_table[(unsigned char)res], EFL_PF );
    set_efl_cc( (res == 0) * EFL_ZF, EFL_ZF );

    if ( max_operand_size == operand_8 ) {
        set_efl_cc( res & 0x80, EFL_SF );
    } else if ( max_operand_size == operand_16 ) {
        set_efl_cc( res & 0x8000, EFL_SF );
    } else {
        set_efl_cc( res & 0x80000000, EFL_SF );
    }

    set_efl_cc( 0, EFL_OF );

    return 0;
}

int _jcc_op( int cc, operand_wrapper_t * ops, int num )
{
    if ( cc ) {
        set_register_value( EIP, get_register_value(EIP) + I8(ops[0]) );
    }

    return 0;
}

int je_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    return _jcc_op( get_register_value(EFL) & EFL_ZF , ops, num );
}

int jne_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    return _jcc_op( !(get_register_value(EFL) & EFL_ZF) , ops, num );
}

int jb_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    return _jcc_op( 1 , ops, num );
}

int add_op( operand_wrapper_t * ops, int num, int instruction_len )
{
    unsigned int res = U32(ops[0]) + U32(ops[1]);
    operand_wrapper_set_value( &ops[0], res );

    set_efl_cc( (res < U32(ops[1])) | (res < U32(ops[0])), EFL_CF );
    set_efl_cc( parity_table[res&0xff], EFL_PF );
    set_efl_cc( (res ^ U32(ops[0]) ^ U32(ops[1])) & EFL_AF, EFL_AF );
    set_efl_cc( (res == 0) * EFL_ZF, EFL_ZF );
    set_efl_cc( res >> 24 & EFL_SF, EFL_SF );
    set_efl_cc( ( (~(U32(ops[0]) ^ U32(ops[1]))) & (U32(ops[0]) ^ res) ) >> 20 & EFL_OF, EFL_OF );

    return 0;
}

int cmp_op(operand_wrapper_t * ops, int num, int instruction_len)
{
	unsigned int res = U32(ops[0]) - U32(ops[1]);

	set_efl_cc(U32(ops[0]) < U32(ops[1]), EFL_CF);
	set_efl_cc(parity_table[res & 0xff], EFL_PF);
	set_efl_cc(((res & 0xff) ^ U8(ops[0]) ^ U8(ops[1])) & EFL_AF, EFL_AF);
	set_efl_cc((res == 0) * EFL_ZF, EFL_ZF);
	set_efl_cc(res >> 24 & EFL_SF, EFL_SF);
	set_efl_cc(((U32(ops[0]) ^ U32(ops[1])) & (U32(ops[0]) ^ res)) >> 20 & EFL_OF, EFL_OF);

	return 0;
}

int lea_op(operand_wrapper_t * ops, int num, int instruction_len)
{
	operand_wrapper_set_value(&ops[0], operand_wrapper_get_value(&ops[1]));

	return 0;
}

/****************************************************/
/* Part5 Instruction decode function implementation */
/****************************************************/

//ref: https://www-user.tu-chemnitz.de/~heha/viewchm.php/hs/x86.chm/x86.htm
/*************************************************/
/* MOD R/M Addressing Mode                       */
/* === === ================================      */
/*  00 000 [ eax ]                               */
/*  01 000 [ eax + disp8 ]               (1)     */
/*  10 000 [ eax + disp32 ]                      */
/*  11 000 register  ( al / ax / eax )   (2)     */
/*  00 001 [ ecx ]                               */
/*  01 001 [ ecx + disp8 ]                       */
/*  10 001 [ ecx + disp32 ]                      */
/*  11 001 register  ( cl / cx / ecx )           */
/*  00 010 [ edx ]                               */
/*  01 010 [ edx + disp8 ]                       */
/*  10 010 [ edx + disp32 ]                      */
/*  11 010 register  ( dl / dx / edx )           */
/*  00 011 [ ebx ]                               */
/*  01 011 [ ebx + disp8 ]                       */
/*  10 011 [ ebx + disp32 ]                      */
/*  11 011 register  ( bl / bx / ebx )           */
/*  00 100 SIB  Mode                     (3)     */
/*  01 100 SIB  +  disp8  Mode                   */
/*  10 100 SIB  +  disp32  Mode                  */
/*  11 100 register  ( ah / sp / esp )           */
/*  00 101 32-bit Displacement-Only Mode (4)     */
/*  01 101 [ ebp + disp8 ]                       */
/*  10 101 [ ebp + disp32 ]                      */
/*  11 101 register  ( ch / bp / ebp )           */
/*  00 110 [ esi ]                               */
/*  01 110 [ esi + disp8 ]                       */
/*  10 110 [ esi + disp32 ]                      */
/*  11 110 register  ( dh / si / esi )           */
/*  00 111 [ edi ]                               */
/*  01 111 [ edi + disp8 ]                       */
/*  10 111 [ edi + disp32 ]                      */
/*  11 111 register  ( bh / di / edi )           */
/*************************************************/

void _decode_op( private_instruction_t * p )
{
    p->op_code.octets[p->op_code_len] = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
    p->instruction_codes[ p->instruction_len ] = p->op_code.octets[p->op_code_len];
    p->op_code_len += 1;
    p->instruction_len += 1;
}

void __decode_dis( private_instruction_t * p, int len )
{
    int i = 0;

    for ( ; i<len; ++i ) {
        p->displacement.octets[i] = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
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
        if ( p->modrm.m.mod == 0 ) {
            if ( p->modrm.m.rm == 0x5 ) {
                _decode_d32( p );
                return;
            }
            return;
        } else if( p->modrm.m.mod == 1 ) {
            _decode_d8( p );
            return;
        } else if ( p->modrm.m.mod == 2 ) {
            _decode_d32( p );
            return;
                }
    }

        ant_log( error, "Fatal error, unknown mod value in %s\n", __FUNCTION__ );
        dump_instruction( -1, p->instruction_codes, p->instruction_len );
        exception_exit( 1 );
}

void _decode_imm( private_instruction_t * p, int len )
{
    int i = 0;

    for ( ; i<len; ++i ) {
        p->imm.octets[i] = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
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
    p->modrm.value = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
    p->instruction_codes[ p->instruction_len ] = p->modrm.value;
    p->instruction_len += 1;
}

void _decode_s( private_instruction_t * p )
{
    p->sib.value = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
    p->instruction_codes[ p->instruction_len ] = p->sib.value;
    p->instruction_len += 1;
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

void d3oms( private_instruction_t * p )
{
    _decode_op( p );
    _decode_m( p );

	if (p->modrm.m.rm == 0x4 && p->modrm.m.mod != 0x3) {
		_decode_s(p);
	}
}

void d4omsi8( private_instruction_t * p )
{
    _decode_op( p );
    _decode_m( p );

	if (p->modrm.m.rm == 0x4 && p->modrm.m.mod != 0x3) {
		_decode_s(p);
	}
	
	_decode_i8( p );
}

void d4omsd( private_instruction_t * p )
{
    _decode_op( p );
    _decode_m( p );

	if (p->modrm.m.rm == 0x4 && p->modrm.m.mod != 0x3) {
		_decode_s(p);
	}
	
	_decode_d( p );
}

void d5omsdi32( private_instruction_t * p )
{
    _decode_op( p );
    _decode_m( p );

	if (p->modrm.m.rm == 0x4 && p->modrm.m.mod != 0x3) {
		_decode_s(p);
	}

	_decode_d( p );
    _decode_i32( p );
}

inline unsigned int calculate_parameter_from_Iz( private_instruction_t * p )
{
    return p->imm.value;
}

unsigned int calculate_base_offset( private_instruction_t * p )
{
    unsigned int base = 0;

    if ( p->modrm.m.mod == 3 ) {
        ant_log(error, "Fatal error. Invalid mod value in %s\n", __FUNCTION__ );
        dump_instruction( -1, p->instruction_codes, p->instruction_len );
        exception_exit( 1 );
    }

    if ( p->sib.s.base != 0x5 ) {
        base = get_register_value(p->sib.s.base + 1);
    } else {
        if ( p->modrm.m.mod == 0 ) {
            base = 0;
        } else {
            base = get_register_value(p->sib.s.base + 1);
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
        sib_offset = base + get_register_value(p->sib.s.index + 1) * ( 1 << p->sib.s.scale );
    }

    return sib_offset;
}

inline unsigned int calculate_parameter_from_M( private_instruction_t * p )
{
    unsigned int src_offset = 0;

    if ( p->modrm.m.mod == 0x3 ) {
        ant_log(error, "Fatal error. Invalid mod value in %s\n", __FUNCTION__ );
        dump_instruction( -1, p->instruction_codes, p->instruction_len );
        exception_exit( 1 );
    } else {
        if ( p->modrm.m.mod == 0x2 || p->modrm.m.mod == 0x1 ) {
            if ( p->modrm.m.rm == 4 ) { //sib mode
				src_offset = calculate_sib_offset(p) + p->displacement.value;
			} else {
				src_offset = get_register_value(p->modrm.m.rm + 1) + p->displacement.value;
            }
        } else {
            if ( p->modrm.m.rm == 5 ) {
                src_offset = p->displacement.value;
            } else if ( p->modrm.m.rm == 4 ) { //sib mode
                src_offset = calculate_sib_offset(p) + p->displacement.value;
            } else {
                src_offset = get_register_value( p->modrm.m.rm + 1 );
            }
        }
    }

    return src_offset;
}

inline unsigned int calculate_parameter_from_Ev( private_instruction_t * p )
{
    union {
        char * p;
        unsigned int v;
    } para;
    unsigned int src_offset = 0;

    if ( p->modrm.m.mod == 0x3 ) {
        para.v = p->modrm.m.rm + 1;
    } else {
        src_offset = calculate_parameter_from_M(p);
        para.p = phy_memory + src_offset;
    }

    return para.v;
}

inline storage_type stype_from_Ev( private_instruction_t * p )
{
    if ( p->modrm.m.mod == 0x3 ) {
        return reg;
    }

    return mem;
}

inline unsigned int calculate_index_from_Gv( private_instruction_t * p )
{
    return (p->modrm.m.reg + 1);
}

inline unsigned int calculate_parameter_from_Iv( private_instruction_t * p )
{
    return p->imm.value;
}

inline unsigned int calculate_parameter_from_Jz( private_instruction_t * p )
{
    return p->displacement.value;
}

void cal_para_Jz( private_instruction_t * p )
{
    p->parameters_num = 1;
    operand_wrapper_init( &p->parameters[0], imm, operand_32, calculate_parameter_from_Jz(p) );
}

void cal_para_Jb( private_instruction_t * p )
{
    p->parameters_num = 1;
    operand_wrapper_init( &p->parameters[0], imm, operand_8, calculate_parameter_from_Jb(p) );
}

void cal_para_RX_Iv( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], oth, operand_8, p->op_code.octets[0] );
    operand_wrapper_init( &p->parameters[1], imm, operand_32, calculate_parameter_from_Iv(p) );
}

void cal_para_Gv_Eb( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], reg, operand_32, calculate_index_from_Gv(p) );
    operand_wrapper_init( &p->parameters[1], stype_from_Eb(p), operand_8, calculate_parameter_from_Eb(p) );
}

void cal_para_Eb_Gb( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], stype_from_Eb(p), operand_8, calculate_parameter_from_Eb(p) );
    operand_wrapper_init( &p->parameters[1], reg, operand_8, calculate_index_from_Gb(p) );
}

void cal_para_Ev_Gv( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], stype_from_Ev(p), operand_32, calculate_parameter_from_Ev(p) );
    operand_wrapper_init( &p->parameters[1], reg, operand_32, calculate_index_from_Gv(p) );
}

void cal_para_Ev_Ib( private_instruction_t * p )
{
    p->parameters_num = 3;
    operand_wrapper_init( &p->parameters[0], stype_from_Ev(p), operand_32, calculate_parameter_from_Ev(p) );
    operand_wrapper_init( &p->parameters[1], imm, operand_8, calculate_parameter_from_Ib(p) );
    operand_wrapper_init( &p->parameters[2], oth, operand_8, p->modrm.m.reg );
}

void cal_para_Gv_Ev( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], reg, operand_32, calculate_index_from_Gv(p) );
    operand_wrapper_init( &p->parameters[1], stype_from_Ev(p), operand_32, calculate_parameter_from_Ev(p) );
}

void cal_para_Ev_Iz( private_instruction_t * p )
{
    p->parameters_num = 2;
    operand_wrapper_init( &p->parameters[0], stype_from_Ev(p), operand_32, calculate_parameter_from_Ev(p) );
    operand_wrapper_init( &p->parameters[1], imm, operand_32, calculate_parameter_from_Iz(p) );
}

void cal_para_Gv_M( private_instruction_t * p )
{
    p->parameters_num = 2;
	operand_wrapper_init( &p->parameters[0], reg, operand_32, calculate_index_from_Gv(p) );
    operand_wrapper_init( &p->parameters[1], imm, operand_32, calculate_parameter_from_M(p) );
}

void d_Ev_Ib( private_instruction_t * p )
{
    d4omsi8( p );
    cal_para_Ev_Ib( p );
}

void d_Eb_Gb(private_instruction_t * p)
{
	d3oms(p);
	cal_para_Eb_Gb(p);
}

void d_Gv_Ev( private_instruction_t * p )
{
    d4omsd( p );
    cal_para_Gv_Ev( p );
}

void movzx_d( private_instruction_t * p )
{
    d4omsd( p );
    cal_para_Gv_Eb( p );
}

void simple_d( private_instruction_t * p )
{
    _decode_op( p );

    p->parameters_num = 1;
    operand_wrapper_init( &p->parameters[0], oth, operand_8, p->op_code.octets[0] );
}

void call_d( private_instruction_t * p )
{
    d2od32( p );
    cal_para_Jz( p );
}

void jb_d( private_instruction_t * p )
{
    d2od8( p );
    cal_para_Jb( p );
}

void mov_RI_d( private_instruction_t * p )
{
     d2oi32(p);
	 cal_para_RX_Iv(p);
}

void d_Ev_Gv(private_instruction_t * p)
{
	d3oms(p);
	cal_para_Ev_Gv(p);
}

void movsx_d( private_instruction_t * p )
{
    d3oms( p );
    cal_para_Gv_Eb( p );
}

void g11_mov_d( private_instruction_t * p )
{
    d5omsdi32( p );
    cal_para_Ev_Iz( p );
}

void d_Gv_M( private_instruction_t * p )
{
    d4omsd( p );
    cal_para_Gv_M( p );
}

void inst2_d( private_instruction_t * p )
{
    unsigned char octet = 0;
    decode_ftype p_dec = NULL;

    _decode_op( p );

    octet = fetch_char( phy_memory, get_register_value(EIP) + p->instruction_len );
    p_dec = decode_array_2bytes[ octet ];

    if ( p_dec ) {
        p_dec( p );

        p->parameters_num += 1;
        operand_wrapper_init( &p->parameters[p->parameters_num-1], oth, operand_8, octet );

        return;
    }

    ant_log( error, "Fatal error, unknown instruction\n" );
    dump_instruction( -1, p->instruction_codes, p->instruction_len );
    exception_exit( 1 );
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
    unsigned char instruction_octet = fetch_char( phy_memory, get_register_value(EIP) );
    decode_ftype p_decode_f = decode_array_1byte[ instruction_octet ];

    if ( p_decode_f ) {
        p_decode_f( p_inst->priv );
    } else {
        ant_log( error, "Fatal error, unknown instruction, opcode = 0x%02x\n", instruction_octet );
        exception_exit( 1 );
    }
}

void instruction_run( instruction_t * p_inst )
{
    static int instruction_counter = 0;
    private_instruction_t * p = p_inst->priv;
    instruction_oper_ftype p_op = op_array_1byte[ p->op_code.octets[0] ];

    if ( p_op ) {
        p_op( p->parameters, p->parameters_num, p->instruction_len );
        if ( !is_skip_ip( p_op ) ) {
			set_register_value( EIP, get_register_value(EIP) + p->instruction_len );
        }
    } else {
        ant_log( error, "Fatal error, can't find instruction call back function\n" );
        exception_exit( 1 );
    }

    dump_instruction( ++instruction_counter, p->instruction_codes, p->instruction_len );
    dump_registers();
}

