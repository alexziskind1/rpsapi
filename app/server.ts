import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import * as http from 'http';

import express from 'express';
import { Express, Request, Response, Router } from 'express';

import * as mockgen from './data/mock-data-generator';

import { PtUserWithAuth } from './shared/models';
import {
  PtAuthToken,
  PtComment,
  PtItem,
  PtLoginModel,
  PtRegisterModel,
  PtTask,
  PtUser,
} from './shared/models/domain';
import {
  FilteredIssues,
  ItemsForMonth,
} from './shared/models/domain/statistics';
import { newGuid } from './util/guid';

const port = 8080;

const usersPerPage = 20;

const generatedPtUserWithAuth = mockgen.generateUsers();
const generatedPtUsers = generatedPtUserWithAuth.map((u) => {
  const user: PtUser = {
    avatar: u.avatar,
    dateCreated: u.dateCreated,
    dateDeleted: u.dateDeleted,
    dateModified: u.dateModified,
    fullName: u.fullName,
    id: u.id,
    title: u.title,
  };
  return user;
});
const generatedPtItems = mockgen.generatePTItems(generatedPtUsers);

let currentPtUsersWithAuth = generatedPtUserWithAuth.slice(0);
let currentPtUsers = generatedPtUsers.slice(0);
let currentPtItems = generatedPtItems.slice(0);

function paginateArray(array: [], pageSize: number, pageNumber: number) {
  --pageNumber; // because pages logically start with 1, but technically with 0
  return array.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize);
}

function getNextIntergerId(arrayWithIdProp: { id: number }[]) {
  const newId =
    arrayWithIdProp.length > 0
      ? Math.max(...arrayWithIdProp.map((i) => i.id)) + 1
      : 1;
  return newId;
}

/*
const sslOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
    passphrase: 'Pa$$word1'
};
*/

const app: Express = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/app'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, PUT, GET, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, *'
  );
  next();
});

// ROUTES FOR OUR API
// =================================================================
const router: Router = express.Router();

router.get('/', (req: Request, res: Response) => {
  setTimeout(() => {
    res.json({ message: 'hooray! welcome to our api - codespaces!!' });
  }, 5000);
});

router.post('/auth', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.loginModel) {
      const loginModel = req.body.loginModel as PtLoginModel;

      const foundUser = currentPtUsersWithAuth.find(
        (u) =>
          u.authInfo!.email === loginModel.username &&
          u.authInfo!.password === loginModel.password
      );

      if (foundUser) {
        const now = new Date();
        const expireDate = new Date(now.setFullYear(now.getFullYear() + 1));
        const authToken: PtAuthToken = {
          dateExpires: expireDate,
          access_token: newGuid(),
        };
        res.json({
          authToken,
          user: foundUser,
        });
      } else {
        res.status(401);
        res.json(null);
      }
    } else {
      res.status(401);
      res.json(null);
    }
  } else {
    res.status(401);
    res.json(null);
  }
});

router.post('/register', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.registerModel) {
      const now = new Date();
      const expireDate = new Date(now.setFullYear(now.getFullYear() + 1));
      const authToken: PtAuthToken = {
        dateExpires: expireDate,
        access_token: newGuid(),
      };

      const regModel = req.body.registerModel as PtRegisterModel;

      const usernameExists = !!currentPtUsersWithAuth.find(
        (u) => u.authInfo!.email === regModel.username
      );

      if (usernameExists) {
        res.status(500);
        res.json('User exists');
      } else {
        const nextUserId = getNextIntergerId(currentPtUsersWithAuth);

        const newUser = {
          authInfo: { email: regModel.username, password: regModel.password },
          fullName: regModel.fullName,
          id: nextUserId,
        } as PtUserWithAuth;

        currentPtUsersWithAuth = [...currentPtUsersWithAuth, newUser];

        res.json({
          authToken,
          user: newUser,
        });
      }
    } else {
      res.status(500);
      res.json('Registration failed');
    }
  } else {
    res.status(500);
    res.json('Bad request');
  }
});

router.get('/users', (req: Request, res: Response) => {
  res.json(currentPtUsers);

  // let currentPage = 1;
  // if (req.query && req.query.page) {
  //    currentPage = +req.query.page
  // }

  // const pagedData = paginateArray(currentPtUsers, usersPerPage, currentPage);
  /*
        res.json({
            currentPage: currentPage,
            pageSize: usersPerPage,
            totalItemCount: currentPtUsers.length,
            pageCount: Math.ceil(currentPtUsers.length / usersPerPage),
            data: pagedData
        });
        */
});

router.get('/summaries', (req: Request, res: Response) => {
  const ret = currentPtItems.map((i) => {
    return {
      id: i.id,
      title: i.title,
      type: i.type,
      priority: i.priority,
      estimate: i.estimate,
      status: i.status,
      assigneeId: i.assignee.id,
      assigneeName: i.assignee.fullName,
      assigneeAvatar: i.assignee.avatar,
      dateCreated: i.dateCreated,
    };
  });
  res.json(ret);
});

router.get('/backlog', (req: Request, res: Response) => {
  res.json(currentPtItems);
});

router.get('/myItems', (req: Request, res: Response) => {
  let userId: number;
  if (req.query && req.query.userId) {
    userId = parseInt(req.query.userId as string, undefined);
  }
  let found = false;

  if (currentPtUsers.findIndex((u) => u.id === userId) >= 0) {
    found = true;
  }

  const filteredItems = currentPtItems.filter(
    (i) => i.assignee.id === userId && i.dateDeleted === undefined
  );

  if (!found) {
    res.status(404);
  }
  res.json(filteredItems);
});

router.get('/openItems', (req: Request, res: Response) => {
  const filteredItems = currentPtItems.filter(
    (i) =>
      (i.status === 'Open' || i.status === 'ReOpened') &&
      i.dateDeleted === undefined
  );
  res.json(filteredItems);
});

router.get('/closedItems', (req: Request, res: Response) => {
  const filteredItems = currentPtItems.filter(
    (i) => i.status === 'Closed' && i.dateDeleted === undefined
  );
  res.json(filteredItems);
});

router.get('/item/:id', (req: Request, res: Response) => {
  const itemId = parseInt(req.params.id, undefined);
  const foundItem = currentPtItems.find(
    (i) => i.id === itemId && i.dateDeleted === undefined
  );

  let found = false;
  if (foundItem) {
    found = true;

    const undeletedTasks = foundItem.tasks.filter(
      (t) => t.dateDeleted === undefined
    );
    foundItem.tasks = undeletedTasks;
  }

  if (!found) {
    res.status(404);
    res.json(null);
  } else {
    res.json(foundItem);
  }
});

router.post('/item', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.item) {
      const newItem = req.body.item as PtItem;
      newItem.id = getNextIntergerId(currentPtItems);
      const newItems = [newItem, ...currentPtItems];
      currentPtItems = newItems;
      res.json(newItem);
    } else {
      res.json(null);
    }
  }
});

router.put('/item/:id', (req: Request, res: Response) => {
  const itemId = parseInt(req.params.id, undefined);

  if (req.body) {
    if (req.body.item) {
      let found = false;
      const modifiedItem = req.body.item as PtItem;

      const foundItem = currentPtItems.find(
        (i) => i.id === itemId && i.dateDeleted === undefined
      );

      if (foundItem) {
        found = true;
        const updatedItems = currentPtItems.map((i) => {
          if (i.id === itemId) {
            return modifiedItem;
          } else {
            return i;
          }
        });

        currentPtItems = updatedItems;
      }
      if (!found) {
        res.status(404);
      }
      res.json(modifiedItem);
    }
  }
});

router.delete('/item/:id', (req: Request, res: Response) => {
  const itemId = parseInt(req.params.id, undefined);
  const foundItem = currentPtItems.find(
    (i) => i.id === itemId && i.dateDeleted === undefined
  );
  if (foundItem) {
    const itemToDelete = Object.assign({}, foundItem, {
      dateDeleted: new Date(),
    });
    const updatedItems = currentPtItems.map((i) => {
      if (i.id === itemId) {
        return itemToDelete;
      } else {
        return i;
      }
    });
    currentPtItems = updatedItems;
    res.json({
      id: itemId,
      result: true,
    });
  } else {
    res.status(404);
    res.json({
      id: itemId,
      result: false,
    });
  }
});

router.post('/task', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.task && req.body.itemId) {
      const newTask = req.body.task as PtTask;
      const itemId = parseInt(req.body.itemId, undefined);

      const foundItem = currentPtItems.find(
        (i) => i.id === itemId && i.dateDeleted === undefined
      );

      if (foundItem) {
        newTask.id = getNextIntergerId(foundItem.tasks);

        const updatedTasks = [newTask, ...foundItem.tasks];

        const updatedItem = Object.assign({}, foundItem, {
          tasks: updatedTasks,
        });

        const updatedItems = currentPtItems.map((i) => {
          if (i.id === itemId) {
            return updatedItem;
          } else {
            return i;
          }
        });

        currentPtItems = updatedItems;

        res.json(newTask);
      } else {
        res.status(404);
        res.json({
          id: itemId,
          result: false,
        });
      }
    } else {
      res.json(null);
    }
  }
});

router.put('/task/:id', (req: Request, res: Response) => {
  const taskId = req.params.id;

  if (req.body) {
    if (req.body.task && req.body.itemId) {
      let found = false;
      const modifiedTask = req.body.task as PtTask;
      const itemId = parseInt(req.body.itemId, undefined);

      const foundItem = currentPtItems.find(
        (i) => i.id === itemId && i.dateDeleted === undefined
      );

      if (foundItem) {
        const updatedTasks = foundItem.tasks.map((t) => {
          if (t.id === modifiedTask.id) {
            found = true;
            return modifiedTask;
          } else {
            return t;
          }
        });

        const updatedItem = Object.assign({}, foundItem, {
          tasks: updatedTasks,
        });

        const updatedItems = currentPtItems.map((i) => {
          if (i.id === itemId) {
            return updatedItem;
          } else {
            return i;
          }
        });

        currentPtItems = updatedItems;

        if (!found) {
          res.status(404);
        }
        res.json(modifiedTask);
      } else {
        res.status(404);
        res.json(null);
      }
    }
  }
});

router.post('/task/:itemId/:id', (req: Request, res: Response) => {
  const itemIdStr = req.params.itemId;
  const taskIdStr = req.params.id;

  if (itemIdStr && taskIdStr) {
    const itemId = parseInt(req.params.itemId, undefined);
    const taskId = parseInt(req.params.id, undefined);

    const foundItem = currentPtItems.find(
      (i) => i.id === itemId && i.dateDeleted === undefined
    );
    if (foundItem) {
      let found = false;

      const updatedTasks = foundItem.tasks.map((t) => {
        if (t.id === taskId) {
          found = true;
          const deletedTask: PtTask = {
            ...t,
            dateDeleted: new Date(),
          };
          return deletedTask;
        } else {
          return t;
        }
      });

      const updatedItem = Object.assign({}, foundItem, { tasks: updatedTasks });

      const updatedItems = currentPtItems.map((i) => {
        if (i.id === itemId) {
          return updatedItem;
        } else {
          return i;
        }
      });

      currentPtItems = updatedItems;

      if (!found) {
        res.status(404);
      }
      res.json(true);
    } else {
      res.status(404);
      res.json(false);
    }
  } else {
    res.status(404);
    res.json(false);
  }
});

router.post('/comment', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.comment && req.body.itemId) {
      const newComment = req.body.comment as PtComment;
      const itemId = parseInt(req.body.itemId, undefined);

      const foundItem = currentPtItems.find(
        (i) => i.id === itemId && i.dateDeleted === undefined
      );

      if (foundItem) {
        newComment.id = getNextIntergerId(foundItem.comments);

        const updatedComments = [newComment, ...foundItem.comments];

        const updatedItem = Object.assign({}, foundItem, {
          comments: updatedComments,
        });

        const updatedItems = currentPtItems.map((i) => {
          if (i.id === itemId) {
            return updatedItem;
          } else {
            return i;
          }
        });

        currentPtItems = updatedItems;

        res.json(newComment);
      } else {
        res.status(404);
        res.json(null);
      }
    } else {
      res.json(null);
    }
  }
});

router.get('/photo/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, undefined);
  const user = currentPtUsers.find(
    (u) => u.id === userId && u.dateDeleted === undefined
  );

  if (user) {
    res.sendFile(`${__dirname}/${user.avatar}`);
  } else {
    res.status(404);
    res.json(null);
  }
});

router.delete('/users/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, undefined);

  const user = currentPtUsers.find(
    (u) => u.id === userId && u.dateDeleted === undefined
  );

  if (user) {
    user.dateDeleted = new Date();
    res.json({
      id: userId,
      result: true,
    });
  } else {
    res.status(404);
    res.json({
      id: userId,
      result: false,
    });
  }
});

router.put('/users/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, undefined);
  const modifiedUser = req.body;

  let found = false;

  const newUsers = currentPtUsers.map((u) => {
    if (u.id === userId && u.dateDeleted === undefined) {
      found = true;
      return modifiedUser;
    } else {
      return u;
    }
  });
  currentPtUsers = newUsers;

  if (!found) {
    res.status(404);
  }
  res.json({
    id: userId,
    result: modifiedUser,
  });
});

// statistics

router.get('/stats/statuscounts', (req: Request, res: Response) => {
  const openItemsFilter = (i: PtItem) =>
    (i.status === 'Open' || i.status === 'ReOpened') &&
    i.dateDeleted === undefined;
  const closedItemsFilter = (i: PtItem) =>
    i.status === 'Closed' && i.dateDeleted === undefined;

  const openItems = currentPtItems
    .filter(openItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const closedItems = currentPtItems
    .filter(closedItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const activeItemsCount = openItems.length + closedItems.length;

  res.json({
    activeItemsCount,
    closeRate: (closedItems.length / activeItemsCount) * 100,
    closedItemsCount: closedItems.length,
    openItemsCount: openItems.length,
  });
});

router.get('/stats/prioritycounts', (req: Request, res: Response) => {
  const pLowItemsFilter = (i: PtItem) =>
    i.priority === 'Low' && i.dateDeleted === undefined;
  const pMediumItemsFilter = (i: PtItem) =>
    i.priority === 'Medium' && i.dateDeleted === undefined;
  const pHighItemsFilter = (i: PtItem) =>
    i.priority === 'High' && i.dateDeleted === undefined;
  const pCriticalItemsFilter = (i: PtItem) =>
    i.priority === 'Critical' && i.dateDeleted === undefined;

  const lowItems = currentPtItems
    .filter(pLowItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const mediumItems = currentPtItems
    .filter(pMediumItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const highItems = currentPtItems
    .filter(pHighItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const criticalItems = currentPtItems
    .filter(pCriticalItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));

  res.json({
    critical: criticalItems.length,
    high: highItems.length,
    low: lowItems.length,
    medium: mediumItems.length,
  });
});

router.get('/stats/typecounts', (req: Request, res: Response) => {
  const tBugItemsFilter = (i: PtItem) =>
    i.type === 'Bug' && i.dateDeleted === undefined;
  const tChoreItemsFilter = (i: PtItem) =>
    i.type === 'Chore' && i.dateDeleted === undefined;
  const tImpedimentItemsFilter = (i: PtItem) =>
    i.type === 'Impediment' && i.dateDeleted === undefined;
  const tPbiItemsFilter = (i: PtItem) =>
    i.type === 'PBI' && i.dateDeleted === undefined;

  const bugItems = currentPtItems
    .filter(tBugItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const choreItems = currentPtItems
    .filter(tChoreItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const impedimentItems = currentPtItems
    .filter(tImpedimentItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));
  const pbiItems = currentPtItems
    .filter(tPbiItemsFilter)
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));

  res.json({
    critical: bugItems.length,
    high: choreItems.length,
    low: impedimentItems.length,
    medium: pbiItems.length,
  });
});

router.get('/stats/filteredissues', (req: Request, res: Response) => {
  const openItemsFilter = (i: PtItem) =>
    (i.status === 'Open' || i.status === 'ReOpened') &&
    i.dateDeleted === undefined;
  const closedItemsFilter = (i: PtItem) =>
    i.status === 'Closed' && i.dateDeleted === undefined;

  const items = currentPtItems
    .filter(getItemFilterByUser(req))
    .filter(getItemFilterByDateRange(req));

  const maxDate = new Date(
    Math.max.apply(
      null,
      items.map((i) => new Date(i.dateCreated).valueOf())
    )
  );
  const minDate = new Date(
    Math.min.apply(
      null,
      items.map((i) => new Date(i.dateCreated).valueOf())
    )
  );

  const categories = getDates(minDate, maxDate);

  const itemsByMonth = categories.map((c) => {
    const monthItems = items.filter((i) => {
      if (i.dateCreated) {
        const dc = new Date(i.dateCreated);
        return (
          dc.getMonth() === c.getMonth() && dc.getFullYear() === c.getFullYear()
        );
      }
    });
    return monthItems;
  });

  const categorizedAndDivided = itemsByMonth.map(
    (c): ItemsForMonth => {
      const openItemsForMonth = c.filter(openItemsFilter);
      const closedItemsForMonth = c.filter(closedItemsFilter);
      return {
        closed: closedItemsForMonth,
        open: openItemsForMonth,
      };
    }
  );

  const ret: FilteredIssues = {
    categories,
    items: categorizedAndDivided,
  };

  res.json(ret);
});

function getItemFilterByUser(req: Request): (i: PtItem) => boolean {
  let userFilter = (item: PtItem) => true;
  if (req.query.userId) {
    const userId = parseInt(req.query.userId as string, undefined);
    if (userId > 0) {
      userFilter = (item: PtItem) => item.assignee.id === userId;
    }
  }
  return userFilter;
}

function getItemFilterByDateRange(req: Request): (i: PtItem) => boolean {
  let rangeFilter = (item: PtItem) => true;
  if (req.query.dateStart && req.query.dateEnd) {
    const dateStart = new Date(req.query.dateStart as string);
    const dateEnd = new Date(req.query.dateEnd as string);
    rangeFilter = (item: PtItem) =>
      item.dateCreated >= dateStart && item.dateCreated <= dateEnd;
  }
  return rangeFilter;
}

const addMonths = (to: Date, months: number): Date => {
  const date = new Date(to.valueOf());
  date.setMonth(date.getMonth() + months);
  return date;
};

const getDates = (startDate: Date, endDate: Date) => {
  const dates = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addMonths(currentDate, 1);
  }
  return dates;
};

// error reporting

router.post('/reporterror', (req: Request, res: Response) => {
  if (req.body) {
    if (req.body.errorreport) {
      const reportJSONString = req.body.errorreport as string;
      const fileNameTimeStamp = new Date()
        .toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '_')
        .replace(/\..+/, '');
      fs.writeFileSync(
        `errors/error-report-${fileNameTimeStamp}.json`,
        reportJSONString
      );
    } else {
      res.json(null);
    }
  }
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

const httpServer = http.createServer(app);
// const httpsServer = https.createServer(sslOptions, app);

httpServer.listen(port);
// httpsServer.listen(8443);
