#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include "i386_port_action_map.h"

#define MAX_PORT_ACTION_MAP_NUMBER 128

typedef struct {
	int port_low_bound;
	int port_high_bound;
	port_read_type read_action;
	port_write_type write_action;
} port_action;

port_action port_action_map[MAX_PORT_ACTION_MAP_NUMBER];

void init_port_action_map()
{
	memset( port_action_map, '\0', sizeof(port_action_map) );
}

port_action * scan_port_map( int port )
{
	int i = 0;
	for ( i = 0; i < MAX_PORT_ACTION_MAP_NUMBER; ++i ) {
		if ( port < port_action_map[i].port_high_bound && port >= port_action_map[i].port_low_bound ) {
			return &port_action_map[i];
		}
	}

	return NULL;
}

int register_port_action( int port_low_bound, int port_high_bound, port_read_type read_action, port_write_type write_action )
{
	int i = 0;
	for ( i = 0; i < MAX_PORT_ACTION_MAP_NUMBER; ++i ) {
		if ( port_action_map[i].port_high_bound == 0 ) {
			port_action_map[i].port_low_bound = port_low_bound;
			port_action_map[i].port_high_bound = port_high_bound;
			port_action_map[i].write_action = write_action;
			port_action_map[i].read_action = read_action;

			return 0;
		}
	}

	return -1;
}

int unregister_port_action( int port_low_bound, int port_high_bound )
{
	int i = 0;
	for ( i = 0; i < MAX_PORT_ACTION_MAP_NUMBER; ++i ) {
		if ( port_action_map[i].port_high_bound == port_high_bound && port_action_map[i].port_low_bound == port_low_bound ) {
			port_action_map[i].port_low_bound = 0;
			port_action_map[i].port_high_bound = 0;
			port_action_map[i].write_action = NULL;
			port_action_map[i].read_action = NULL;

			return 0;
		}
	}

	return -1;
}

int port_read( int port )
{
	port_action * pa = scan_port_map( port );
	if ( pa && port < pa->port_high_bound && port >= pa->port_low_bound ) {
		return pa->read_action( port );
	}

	fprintf( stderr, "Fatal error, invalid port %d\n", port );
	exit(1);
}

void port_write( int port, int value )
{
	port_action * pa = scan_port_map( port );
	if ( pa && port < pa->port_high_bound && port >= pa->port_low_bound ) {
		return pa->write_action( port, value );
	}

	fprintf( stderr, "Fatal error, invalid port %d\n", port );
	exit(1);
}
