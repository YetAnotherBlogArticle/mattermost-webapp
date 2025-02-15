// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {act} from '@testing-library/react';

import thunk from 'redux-thunk';

import {ReactWrapper} from 'enzyme';

import {BrowserRouter} from 'react-router-dom';

import {TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import TopChannelsTable from './top_channels_table';

const mockStore = configureStore([thunk]);

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

jest.mock('mattermost-redux/actions/insights', () => ({
    ...jest.requireActual('mattermost-redux/actions/insights'),
    getMyTopChannels: () => ({type: 'adsf', data: {}}),
    getTopChannelsForTeam: () => ({type: 'adsf',
        data: {
            has_next: false,
            items: [
                {
                    id: '4r98uzxe4b8t5g9ntt9zcdzktw',
                    type: 'P',
                    display_name: 'nesciunt',
                    name: 'sequi-7',
                    team_id: 'team_id1',
                    message_count: 1,
                },
                {
                    id: '4r98uzxe4b8t5gfdsdfggs',
                    type: 'P',
                    display_name: 'test',
                    name: 'test-7',
                    team_id: 'team_id1',
                    message_count: 2,
                },
            ],
        }}),
}));

describe('components/activity_and_insights/insights/top_channels', () => {
    const props = {
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        closeModal: jest.fn(),
    };

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
            },
        },
    };

    test('check if 2 team top channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopChannelsTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(2);
    });

    test('check if 0 my top channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopChannelsTable
                        {...props}
                        filterType={'MY'}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
