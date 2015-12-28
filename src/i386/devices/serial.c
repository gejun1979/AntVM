#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include "serial.h"
#include "../i386_port_action_map.h"

#define RBR 0
#define THR 0
#define IER 1
#define IIR 2
#define FCR 2
#define LCR 3
#define MCR 4
#define LSR 5
#define TST 5
#define MSR 6
#define SPR 7

typedef struct {
	char rbr;
	char thr;
	char ier;
	char iir;
	char fcr;
	char lcr;
	char mcr;
	char lsr;
	char tst;
	char msr;
	char spr;
	union {
		unsigned short value;
		struct {
			char dll;
			char dlm;
		};
	};
	char psr;
} serial_reg_def;

serial_reg_def serial_reg;

void serial_port_reset()
{
	memset( &serial_reg, '\0', sizeof(serial_reg) );

	serial_reg.iir = 0x01;
	serial_reg.lsr = 0x60;
	serial_reg.dll = 0x01;
	serial_reg.psr = 0x01;
}

void update_irq()
{
    if ((serial_reg.lsr & 0x01) && (serial_reg.ier & 0x01)) {
		//rhr interrupt is enabled and rhr ready
        serial_reg.iir = 0x04; // rhr ready
    } else if ((serial_reg.lsr & 0x20) && (serial_reg.ier & 0x02)) {
		//thr interrupt is enabled and thr empty
        serial_reg.iir = 0x02; // thr empty
    } else {
        serial_reg.iir = 0x01; // no interrupt
    }
}

void send_char(char value)
{
    serial_reg.rbr = value;
    serial_reg.lsr |= 0x01;

    update_irq();
}

void recieve_char(char value)
{
#ifdef _WIN32
#else
    fprintf( stdout, "%c", value );
#endif
}

int serial_port_read( int port )
{
    char value = 0;

    switch ( port - 0x3f8 ) {
    case RBR:
        if (serial_reg.lcr & 0x80) {
            value = serial_reg.dll;
        } else {
            serial_reg.lsr &= ~ (0x01 | 0x10);
            update_irq();

            send_char(value);
        }
        break;
    case IER:
        if (serial_reg.lcr & 0x80) {
            value = serial_reg.dlm;
        } else {
            value = serial_reg.ier;
        }
        break;
    case IIR:
        if (serial_reg.lcr & 0x80) {
            value = serial_reg.psr;
        } else {
			value = serial_reg.iir;
        }
        break;
    case LCR:
        value = serial_reg.lcr;
        break;
    case MCR:
        value = serial_reg.mcr;
        break;
    case LSR:
        value = serial_reg.lsr;
        break;
    case MSR:
        value = serial_reg.msr;
        break;
    case SPR:
        value = serial_reg.spr;
        break;
    default:
		fprintf( stderr, "Unknown port 0x%08x\n", port );
		exit(1);
    }

    return value;
}

void serial_port_write( int port, int value )
{
    switch ( port - 0x3f8 ) {
    case THR:
        if (serial_reg.lcr & 0x80) {
            serial_reg.dll = value;
        } else {
            serial_reg.lsr &= ~0x20;
            update_irq();

            recieve_char(value);

            serial_reg.lsr |= 0x20;
            serial_reg.lsr |= 0x40;
            update_irq();
        }
        break;
    case IER:
        if (serial_reg.lcr & 0x80) {
            serial_reg.dlm = value;
        } else {
            serial_reg.ier = value;
            update_irq();
        }
        break;
    case FCR:
        if (serial_reg.lcr & 0x80) {
            serial_reg.psr = value;
        } else {
			serial_reg.fcr = value;
        }
        break;
    case LCR:
        serial_reg.lcr = value;
        break;
    case MCR:
        serial_reg.mcr = value;
        break;
    case TST:
        serial_reg.tst = value;
        break;
    case MSR:
        break;
    case SPR:
        serial_reg.spr = value;
        break;
    default:
		fprintf( stderr, "Unknown port 0x%08x\n", port );
		exit(1);
    }
}

void init_serial()
{
	serial_port_reset();

	register_port_action( 0x3f8, 0x400, serial_port_read, serial_port_write );
}

void uninit_serial()
{
	unregister_port_action( 0x3f8, 0x400 );
}
