// node imports
import * as fileSystemModule from 'fs';

// 3rd party imports
import * as faker from 'faker';
import * as _ from 'lodash';

// app imports
import { PtUserAuthInfo, PtUserWithAuth } from '../shared/models';
import {
    PtComment,
    PtItem,
    PtTask
} from '../shared/models/domain';
import { ItemTypeEnum, PriorityEnum, StatusEnum } from '../shared/models/domain/enums';
import { PtItemType } from '../shared/models/domain/types';
import { toTitleCase } from '../util/string-utils';

const NUM_PT_ITEMS = 200;
const NUM_USERS = 20;

export function generatePTItems(users: PtUserWithAuth[]): PtItem[] {
    const items = _.times(NUM_PT_ITEMS, (index: number) => {
        return generatePTItem(index, users);
    });
    return items;
}

export function generatePTItem(index: number, users: PtUserWithAuth[]): PtItem {
    const nearFuture = new Date();
    nearFuture.setMonth(new Date().getMonth() + 1);
    const date = faker.date.between(
        faker.date.past(1),
        nearFuture);

    const title = toTitleCase(faker.company.bs());

    const typeStr = faker.random.arrayElement(Object.getOwnPropertyNames(ItemTypeEnum));
    const type = typeStr as ItemTypeEnum;

    const priorityStr = faker.random.arrayElement(Object.getOwnPropertyNames(PriorityEnum));
    const priority = priorityStr as PriorityEnum;

    const statusStr = faker.random.arrayElement(Object.getOwnPropertyNames(StatusEnum));
    const status = statusStr as StatusEnum;

    const ptItem: PtItem = {
        assignee: _.sample(users)!,
        comments: generateComments(users),
        dateCreated: date,
        dateModified: date,
        description: faker.lorem.sentence(10, 10),
        estimate: _.random(1, 24),
        id: index + 1,
        priority,
        status,
        tasks: generateTasks(date),
        title,
        type,
    };

    return ptItem;
}

export function generateTasks(fromDate: Date): PtTask[] {
    const numTasks = _.random(5, 20);
    const tasks = _.times(numTasks, (index: number) => {
        return generateTask(index, fromDate);
    });
    return tasks;
}

export function generateTask(index: number, fromDate: Date): PtTask {
    const createdDate = faker.date.between(fromDate, new Date());

    const title = toTitleCase(faker.company.bs());
    const task: PtTask = {
        completed: faker.random.boolean(),
        dateCreated: createdDate,
        dateModified: createdDate,
        id: index + 1,
        title
    };

    const scheduleTask = faker.random.boolean();
    if (scheduleTask) {
        const tempDate = faker.date.between(fromDate, new Date());
        task.dateStart = new Date(tempDate.getTime());
        tempDate.setHours(tempDate.getHours() + faker.random.number(60));
        task.dateEnd = new Date(tempDate.getTime());
    }

    return task;
}

export function generateUsersBase64Avatars(): PtUserWithAuth[] {
    const avatarsMenBase64 = getUserAvatars('app/images/avatars/base64/men.txt');
    const avatarsWomenBase64 = getUserAvatars('app/images/avatars/base64/women.txt');

    const users = _.times(NUM_USERS, (index: number) => {
        return generateUserBase64Avatar(index, avatarsMenBase64, avatarsWomenBase64);
    });
    const userMe = getMeUserBase64(users.length);
    users.unshift(userMe);
    return users;
}

export function generateUsers(): PtUserWithAuth[] {
    const users = _.times(NUM_USERS, (index: number) => {
        return generateUser(index);
    });

    const userMe = getMeUser(users.length);
    users.unshift(userMe);
    return users;
}

export function getMeUserBase64(index: number): PtUserWithAuth {
    const avatarMe = getUserAvatars('app/images/avatars/base64/me.txt')[0];
    const date = faker.date.past(1);
    const userMe: PtUserWithAuth = {
        avatar: avatarMe,
        dateCreated: date,
        dateModified: date,
        fullName: 'Alex Ziskind',
        id: index + 1
    };
    return userMe;
}

export function getMeUser(index: number): PtUserWithAuth {
    const date = faker.date.past(1);
    const userMe: PtUserWithAuth = {
        authInfo: { email: 'alex@email.com', password: 'nuvious' },
        avatar: 'images/avatars/me/me.png',
        dateCreated: date,
        dateModified: date,
        fullName: 'Alex Ziskind',
        id: index + 1
    };
    return userMe;
}

export function generateUserBase64Avatar(
    index: number,
    avatarsMen: string[],
    avatarsWomen: string[] = []
): PtUserWithAuth {
    const genderBool = faker.random.boolean();
    const firstName = faker.name.firstName(genderBool ? 1 : 0);
    const lastName = faker.name.lastName(genderBool ? 1 : 0);
    const date = faker.date.past(1);
    let avatar;
    if (avatarsWomen) {
        avatar = genderBool ? _.sample(avatarsMen) : _.sample(avatarsWomen);
    } else {
        avatar = _.sample(avatarsMen);
    }

    const user: PtUserWithAuth = {
        avatar: avatar!,
        dateCreated: date,
        dateModified: date,
        fullName: firstName + ' ' + lastName,
        id: index + 1
    };
    return user;
}

export function generateUser(index: number): PtUserWithAuth {
    const genderBool = faker.random.boolean();
    const firstName = faker.name.firstName(genderBool ? 1 : 0);
    const lastName = faker.name.lastName(genderBool ? 1 : 0);
    const date = faker.date.past(1);

    const avatar = `images/avatars/${genderBool ? 'males' : 'females'}/image-${index + 1}.png`;

    const authInfo: PtUserAuthInfo = {
        email: `${firstName}.${lastName}@${faker.internet.domainName()}`,
        password: 'nuvious',
    };

    const user: PtUserWithAuth = {
        authInfo,
        avatar,
        dateCreated: date,
        dateModified: date,
        fullName: firstName + ' ' + lastName,
        id: index + 1
    };
    return user;
}

export function generateComments(users: PtUserWithAuth[]): PtComment[] {
    const numComments = _.random(0, 5);
    const comments = _.times(numComments, (index: number) => {
        return generateComment(index, users);
    });
    return comments;
}

export function generateComment(index: number, users: PtUserWithAuth[]): PtComment {
    const date = faker.date.past(1);
    const commentText = toTitleCase(faker.lorem.sentence(50, 40));

    const comment: PtComment = {
        dateCreated: date,
        dateModified: date,
        id: index + 1,
        title: commentText,
        user: _.sample(users)!
    };
    return comment;
}

export function getUserAvatars(path: string) {
    const avatarList: string[] = [];

    const fileBuffer = fileSystemModule.readFileSync(path);
    const fileText = fileBuffer.toString();

    const lines = fileText.split('\n');
    for (const line of lines) {
        avatarList.push('data:image/png;base64,' + line);
    }
    /*
    for (let i = 0; i < lines.length; i++) {
        avatarList.push('data:image/png;base64,' + lines[i]);
    }
    */
    return avatarList;
}
